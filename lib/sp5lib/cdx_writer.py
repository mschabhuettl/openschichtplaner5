"""Reader and writer for the compound index files (``.CDX``) of SP5 tables.

Every table has one index file with a single tag: ``ID_TAG`` for the data
tables and ``NUMBER_TAG`` for the journals, both with the filter
``.NOT. DELETED()``. The key is either one numeric field (``ID``,
``NUMBER``) or a concatenation ``STR(ID,11)+STR(<field>,11)[+...]``.

File layout (pages of 512 bytes, see ``docs/format.md`` for details):

  page 0   header of the tag directory
  page 1   unused
  page 2   header of the tag
  page 3   key expression and filter expression of the tag
  page 4   root leaf of the tag directory (tag name -> page 2)
  page 5.. nodes of the tag: leaves, followed by the interior nodes if the
           keys need more than one leaf; the root node is the last page

The writer reproduces the index files of the SP5 sample database byte for
byte, except for a change counter in the directory header (offset 8) that
cannot be derived from the table content; it is taken over from the
existing file.
"""

import os
import struct
from dataclasses import dataclass

from .dbf_reader import DELETED, _dedupe_names, _parse_record, get_table_fields
from .schema import FOR_EXPRESSION, TABLE_TAG

__all__ = ["CdxIndex", "build_cdx", "build_cdx_bytes", "read_cdx", "write_cdx"]

PAGE = 512
_TAG_HEADER = 2 * PAGE
_TAGLIST_ROOT = 4 * PAGE
_FIRST_NODE = 5
_TAGLIST_KEYLEN = 10

Key = tuple[bytes, int]  # (key bytes, record number starting at 1)


@dataclass(frozen=True)
class CdxIndex:
    """Content of an index file with one tag."""

    tag: str
    key_expression: str
    for_expression: str
    key_length: int
    counter: int
    entries: list[Key]


# --- keys ---


def _parse_key_expr(key_expr: str) -> tuple[str, object]:
    """Return ``("numeric", field)`` or ``("char", [(field, width), ...])``."""
    expr = key_expr.strip()
    if "+" not in expr and "(" not in expr:
        if not expr.isidentifier():
            raise ValueError(f"Unsupported CDX key expression: {expr!r}")
        return ("numeric", expr)
    terms: list[tuple[str, int]] = []
    for part in expr.split("+"):
        part = part.strip()
        if not (part.startswith("STR(") and part.endswith(")")):
            raise ValueError(f"Unsupported CDX key expression term: {part!r}")
        field, width = part[4:-1].split(",")
        terms.append((field.strip(), int(width)))
    return ("char", terms)


def _key_shape(key_expr: str) -> tuple[int, bytes]:
    """Key length and padding byte of a key expression."""
    kind, spec = _parse_key_expr(key_expr)
    if kind == "numeric":
        return 8, b"\x00"
    return sum(width for _, width in spec), b"\x20"  # type: ignore[union-attr]


def _numeric_key(value: float) -> bytes:
    """A number as index key: big-endian double made sortable as bytes."""
    b = bytearray(struct.pack(">d", float(value)))
    if b[0] & 0x80:
        for i in range(8):
            b[i] ^= 0xFF
    else:
        b[0] |= 0x80
    return bytes(b)


def _char_key(record: dict, terms: list[tuple[str, int]]) -> bytes:
    return b"".join(
        str(int(record.get(field) or 0)).rjust(width).encode("ascii")[:width]
        for field, width in terms
    )


def _build_keys(filepath: str, key_expr: str) -> list[Key]:
    """Sorted keys of all records of a table that are not deleted."""
    fields = get_table_fields(filepath)
    names = _dedupe_names([str(f["name"]) for f in fields])
    kind, spec = _parse_key_expr(key_expr)
    with open(filepath, "rb") as f:
        head = f.read(32)
        num_records, header_size, record_size = struct.unpack_from("<IHH", head, 4)
        f.seek(header_size)
        keys: list[Key] = []
        for raw_idx in range(num_records):
            raw = f.read(record_size)
            if len(raw) < record_size:
                break
            if raw[0] == DELETED:
                continue
            record = _parse_record(raw, fields, names)
            if kind == "numeric":
                key = _numeric_key(record.get(spec) or 0)  # type: ignore[call-overload]
            else:
                key = _char_key(record, spec)  # type: ignore[arg-type]
            keys.append((key, raw_idx + 1))
    keys.sort()
    return keys


# --- nodes ---


def _entry_bit_layout(keylen: int) -> tuple[int, int]:
    """Bits used for the record number and for each of the two counts in a
    leaf entry of three bytes."""
    count_bits = 4 if keylen <= 15 else 5 if keylen <= 31 else 6
    return 24 - 2 * count_bits, count_bits


def _compress(key: bytes, prev: bytes, keylen: int, pad: bytes) -> tuple[int, int]:
    """Bytes shared with the previous key and trailing padding bytes.

    Trailing bytes are only dropped from character keys.
    """
    dup = 0
    while dup < keylen and dup < len(prev) and prev[dup] == key[dup]:
        dup += 1
    trail = 0
    if pad == b"\x20":
        while trail < keylen - dup and key[keylen - 1 - trail] == 0x20:
            trail += 1
    return dup, trail


def _split_into_leaves(keys: list[Key], keylen: int, pad: bytes) -> list[list[Key]]:
    """Fill leaves one after the other with as many keys as fit."""
    pages: list[list[Key]] = []
    cur: list[Key] = []
    used = 0
    prev = b""
    for key, recno in keys:
        dup, trail = _compress(key, prev, keylen, pad)
        fresh = keylen - dup - trail
        if cur and 24 + (len(cur) + 1) * 3 + used + fresh > PAGE:
            pages.append(cur)
            cur, used = [], 0
            dup, trail = _compress(key, b"", keylen, pad)
            fresh = keylen - dup - trail
        cur.append((key, recno))
        used += fresh
        prev = key
    if cur or not pages:
        pages.append(cur)
    return pages


def _encode_leaf(
    keys: list[Key], keylen: int, pad: bytes, attr: int, left: int, right: int
) -> bytes:
    recno_bits, count_bits = _entry_bit_layout(keylen)
    recno_mask = (1 << recno_bits) - 1
    count_mask = (1 << count_bits) - 1
    entries = bytearray()
    chunks = []
    prev = b""
    for key, recno in keys:
        dup, trail = _compress(key, prev, keylen, pad)
        value = (recno & recno_mask) | (dup << recno_bits) | (trail << (recno_bits + count_bits))
        entries += value.to_bytes(3, "little")
        chunks.append(key[dup : keylen - trail])
        prev = key
    # Key bytes are stored from the end of the page towards the entries.
    chars = b"".join(reversed(chunks))

    page = bytearray(PAGE)
    struct.pack_into("<HHii", page, 0, attr, len(keys), left, right)
    struct.pack_into("<HI", page, 12, PAGE - 24 - len(entries) - len(chars), recno_mask)
    page[18:24] = bytes([count_mask, count_mask, recno_bits, count_bits, count_bits, 3])
    page[24 : 24 + len(entries)] = entries
    page[PAGE - len(chars) :] = chars
    return bytes(page)


def _encode_interior(
    separators: list[tuple[bytes, int, int]], keylen: int, attr: int, left: int, right: int
) -> bytes:
    """Interior node: for every child its last key, the record number of
    that key and the page offset of the child."""
    page = bytearray(PAGE)
    struct.pack_into("<HHii", page, 0, attr, len(separators), left, right)
    off = 12
    for key, recno, child in separators:
        page[off : off + keylen] = key
        struct.pack_into(">II", page, off + keylen, recno, child)
        off += keylen + 8
    return bytes(page)


def _encode_index_header(
    root: int, counter: int, keylen: int, options: int, key_expr: str | None
) -> bytes:
    page = bytearray(PAGE)
    struct.pack_into("<Ii", page, 0, root, 0)
    struct.pack_into(">I", page, 8, counter)
    struct.pack_into("<H", page, 12, keylen)
    page[14] = options
    page[15] = 1
    if key_expr is None:
        struct.pack_into("<HHHHH", page, 0x1F6, 0, 1, 1, 0, 1)
    else:
        size = len(key_expr) + 1
        struct.pack_into("<HHHHH", page, 0x1F6, 0, size, len(FOR_EXPRESSION) + 1, 0, size)
    return bytes(page)


def _encode_taglist_leaf(tag_name: str) -> bytes:
    """Leaf of the tag directory: the tag name pointing to the tag header."""
    name = tag_name.encode("ascii")[:_TAGLIST_KEYLEN]
    trail = _TAGLIST_KEYLEN - len(name)
    page = bytearray(PAGE)
    struct.pack_into("<HHii", page, 0, 0x0003, 1, -1, -1)
    struct.pack_into("<HI", page, 12, PAGE - 27 - len(name), 0xFFFF)
    page[18:24] = bytes([0x0F, 0x0F, 16, 4, 4, 3])
    page[24:27] = (_TAG_HEADER | (trail << 20)).to_bytes(3, "little")
    page[PAGE - len(name) :] = name
    return bytes(page)


def _build_tag_nodes(keys: list[Key], keylen: int, pad: bytes) -> tuple[list[bytes], int]:
    """Node pages of the tag and the page number of its root.

    The leaves come first, then one level of interior nodes after the
    other; the root is the last page.
    """
    chunks = _split_into_leaves(keys, keylen, pad)
    if len(chunks) == 1:
        return [_encode_leaf(keys, keylen, pad, 0x0003, -1, -1)], _FIRST_NODE

    def siblings(i: int, count: int, first_page: int) -> tuple[int, int]:
        offset = (first_page + i) * PAGE
        return (offset - PAGE if i > 0 else -1, offset + PAGE if i < count - 1 else -1)

    pages = []
    level = []  # (last key, its record number, page offset) of every node
    for i, chunk in enumerate(chunks):
        pages.append(
            _encode_leaf(chunk, keylen, pad, 0x0002, *siblings(i, len(chunks), _FIRST_NODE))
        )
        level.append((chunk[-1][0], chunk[-1][1], (_FIRST_NODE + i) * PAGE))
    capacity = (PAGE - 12) // (keylen + 8)
    while len(level) > 1:
        first_page = _FIRST_NODE + len(pages)
        groups = [level[i : i + capacity] for i in range(0, len(level), capacity)]
        attr = 0x0001 if len(groups) == 1 else 0x0000
        level = []
        for i, group in enumerate(groups):
            pages.append(
                _encode_interior(group, keylen, attr, *siblings(i, len(groups), first_page))
            )
            level.append((group[-1][0], group[-1][1], (first_page + i) * PAGE))
    return pages, _FIRST_NODE + len(pages) - 1


def build_cdx(keys: list[Key], key_expr: str, tag_name: str = TABLE_TAG, counter: int = 0) -> bytes:
    """Build an index file from sorted ``(key, record number)`` pairs."""
    keylen, pad = _key_shape(key_expr)
    nodes, root_page = _build_tag_nodes(keys, keylen, pad)
    expressions = key_expr.encode("ascii") + b"\x00" + FOR_EXPRESSION.encode("ascii") + b"\x00"
    pages = [
        _encode_index_header(_TAGLIST_ROOT, counter, _TAGLIST_KEYLEN, 0xE0, None),
        b"\x00" * PAGE,
        _encode_index_header(root_page * PAGE, 0, keylen, 0x68, key_expr),
        expressions.ljust(PAGE, b"\x00"),
        _encode_taglist_leaf(tag_name),
    ]
    return b"".join(pages + nodes)


def build_cdx_bytes(filepath: str, key_expr: str, counter: int, tag_name: str = TABLE_TAG) -> bytes:
    """Build the index file for the current content of the table *filepath*."""
    return build_cdx(_build_keys(filepath, key_expr), key_expr, tag_name, counter)


# --- reading ---


def _leaf_entries(page: bytes, keylen: int, pad: bytes) -> list[Key]:
    count = struct.unpack_from("<H", page, 2)[0]
    recno_mask = struct.unpack_from("<I", page, 14)[0]
    dup_mask, trail_mask, recno_bits, dup_bits, _, entry_size = page[18:24]
    entries: list[Key] = []
    end = PAGE
    prev = b""
    for i in range(count):
        value = int.from_bytes(page[24 + i * entry_size : 24 + (i + 1) * entry_size], "little")
        dup = (value >> recno_bits) & dup_mask
        trail = (value >> (recno_bits + dup_bits)) & trail_mask
        fresh = keylen - dup - trail
        key = prev[:dup] + page[end - fresh : end] + pad * trail
        end -= fresh
        entries.append((key, value & recno_mask))
        prev = key
    return entries


def read_cdx(cdx_path: str) -> CdxIndex:
    """Read an index file with one tag, as SP5 writes them.

    Raises ``ValueError`` if the file does not have that structure.
    """
    with open(cdx_path, "rb") as f:
        data = f.read()
    if len(data) < 6 * PAGE or len(data) % PAGE:
        raise ValueError(f"not an SP5 index file: {cdx_path}")
    counter = struct.unpack_from(">I", data, 8)[0]
    taglist_root = struct.unpack_from("<I", data, 0)[0]
    tags = _leaf_entries(data[taglist_root : taglist_root + PAGE], _TAGLIST_KEYLEN, b"\x20")
    if len(tags) != 1:
        raise ValueError(f"expected one tag in {cdx_path}, found {len(tags)}")
    tag_name, header = tags[0]
    keylen = struct.unpack_from("<H", data, header + 12)[0]
    pool = data[header + PAGE : header + 2 * PAGE]
    key_expr, for_expr = (part.decode("ascii") for part in pool.split(b"\x00")[:2])
    pad = _key_shape(key_expr)[1]

    # Walk down to the leftmost leaf, then follow the links to the right.
    offset = struct.unpack_from("<I", data, header)[0]
    while not struct.unpack_from("<H", data, offset)[0] & 0x0002:
        offset = struct.unpack_from(">I", data, offset + 12 + keylen + 4)[0]
    entries: list[Key] = []
    while offset != -1:
        page = data[offset : offset + PAGE]
        entries += _leaf_entries(page, keylen, pad)
        offset = struct.unpack_from("<i", page, 8)[0]
    return CdxIndex(tag_name.rstrip().decode("ascii"), key_expr, for_expr, keylen, counter, entries)


# --- rebuilding in place ---


def _cdx_path(filepath: str) -> str | None:
    base = os.path.splitext(filepath)[0]
    for ext in (".CDX", ".cdx"):
        if os.path.exists(base + ext):
            return base + ext
    return None


def _read_tag_name(cdx_path: str) -> str | None:
    try:
        return read_cdx(cdx_path).tag
    except (OSError, ValueError):
        return None


def _read_key_expr(cdx_path: str) -> str | None:
    try:
        return read_cdx(cdx_path).key_expression
    except (OSError, ValueError):
        return None


def write_cdx(filepath: str) -> str | None:
    """Rebuild the index file of the table *filepath* from its content.

    Tag name, key expression and change counter are taken from the existing
    index file. Returns its path, or ``None`` if there is no readable index
    file. Raises ``ValueError`` for a key expression that is not supported.
    """
    cdx_path = _cdx_path(filepath)
    if cdx_path is None:
        return None
    try:
        old = read_cdx(cdx_path)
    except (OSError, ValueError, UnicodeDecodeError, struct.error):
        return None
    data = build_cdx_bytes(filepath, old.key_expression, old.counter, old.tag)
    tmp = cdx_path + ".tmp"
    with open(tmp, "wb") as f:
        f.write(data)
    os.replace(tmp, cdx_path)
    return cdx_path
