# The Schichtplaner 5 database format

This document describes the files in which Schichtplaner 5 (SP5) keeps its
data, as far as this project understands them. It was written from the
sample database that ships with SP5 5.0.13, from the behaviour of the
program, and from analysing the program for the purpose of interoperability.
It is not vendor documentation and may be wrong or incomplete; everything
not confirmed is marked.

How sure a statement is:

- no mark: seen in the sample database or confirmed by running SP5;
- *(program)*: derived from analysing the program, not seen in data;
- *(assumed)*: plausible and used by this library, but not confirmed;
- *(unknown)*: not understood.

## 1. Files

A database is one directory with 120 files: for each of the 30 tables

| File | Content |
|---|---|
| `5NAME.DBF` | the table |
| `5NAME.CDX` | its index |
| `5NAME-L.DBF` | the change journal of the table |
| `5NAME-L.CDX` | the index of the journal |

There are no memo files (`.FPT`, `.DBT`): no table has a memo field.
File names are upper case. SP5 uses the CodeBase library to access the files.

## 2. Table files (DBF)

The tables are plain dBASE III files.

### 2.1 Header

| Offset | Size | Content |
|---|---|---|
| 0 | 1 | `0x03` (dBASE III without memo) |
| 1 | 3 | date of the last change: year minus 2000 (two digits), month, day |
| 4 | 4 | number of records, little endian, including deleted ones |
| 8 | 2 | size of the header in bytes: `32 + 32 * fields + 1` |
| 10 | 2 | size of a record in bytes: `1 +` the sum of the field lengths |
| 12 | 16 | zero |
| 28 | 1 | `0x01`: the table has a production index (`.CDX`) |
| 29 | 1 | code page mark, always `0x00` (none) |
| 30 | 2 | zero |

The field descriptors follow, 32 bytes each:

| Offset | Size | Content |
|---|---|---|
| 0 | 11 | field name, upper case ASCII, padded with zero bytes |
| 11 | 1 | type: `N`, `C`, `D` or `F` |
| 12 | 4 | offset of the field in the record, little endian (the first field is at 1) |
| 16 | 1 | length |
| 17 | 1 | decimals, always 0 |
| 18 | 14 | zero |

The header ends with the byte `0x0D`. The records follow without separator,
and the file ends with the byte `0x1A`. An empty table is therefore
`header size + 1` bytes long.

### 2.2 Records

The first byte of a record is the deletion flag: a space for a valid record,
`*` (`0x2A`) for a deleted one. Deleted records stay in the file until the
table is packed. The fields follow at fixed offsets.

### 2.3 Field types

Only four dBASE types occur. There are no logical (`L`) and no memo (`M`)
fields; flags are numeric fields of length 1 with the values 0 and 1.

**N, numeric.** A decimal integer in ASCII, right-aligned and padded with
spaces on the left: `"         40"` for 40 in a field of length 11. The
lengths in use are 11 (IDs, positions, colours), 5 (codes, small numbers)
and 1 (flags). SP5 always writes a number, `0` for nothing.

**F, float.** A decimal number in ASCII with exactly four decimals,
right-aligned in 19 bytes: `"             7.7000"`. The descriptor declares
no decimals all the same.

**D, date.** Eight ASCII digits `YYYYMMDD`. An unset date is eight spaces.
The four records of 5XCHAR in the sample hold the text `invalid ` in their
unused `DATE` field; readers must treat anything that is not a date as unset.

**C, character.** Character fields are used in four different ways. Which
one applies depends on the field, not on a marker in the file:

- *Text.* UTF-16 LE, followed by a zero code unit (two zero bytes) and
  padded with spaces (`0x20`) to the field length. An empty text is two zero
  bytes followed by spaces. A field of length n therefore holds at most
  `n / 2 - 1` characters: 99 for the common length 200, 125 for length 252,
  29 for length 60. All names, descriptions and notes are text fields.
- *Single-byte text.* ASCII, padded with spaces, no terminator. These are
  the fields `WORKDAYS`, `VALIDDAYS`, `DAILYDEM`, `STARTEND` and
  `STARTEND0` to `STARTEND7`, and in 5USER `CATEGORY` and `REPORT`. They
  hold lists of numbers or times, see section 4.
- *Binary.* Raw bytes: `DIGEST` in 5USER, `CREATIME` and `UUID` in 5BUILD.
- *Reserved.* Every table ends with a field `RESERVED` of 20, 50 or 200
  bytes. In every record of the sample it consists of zero bytes only.

There is no code page: the code page byte in the header is zero, and text is
stored as UTF-16, so any script can be stored. The single-byte fields hold
ASCII only.

## 3. Index files (CDX)

Each table has one compound index file in the FoxPro CDX format with a
single tag. SP5 uses the index to find records by key.

| Table | Tag | Key expression | Filter |
|---|---|---|---|
| table with a one-part key | `ID_TAG` | `ID` | `.NOT. DELETED()` |
| table with a two-part key | `ID_TAG` | `STR(ID,11)+STR(<owner>,11)` | `.NOT. DELETED()` |
| 5CYEXC | `ID_TAG` | `STR(ID,11)+STR(EMPLOYEEID,11)+STR(CYCLEASSID,11)` | `.NOT. DELETED()` |
| journal | `NUMBER_TAG` | `NUMBER` | `.NOT. DELETED()` |

The key of each table is listed in section 5. Because of the filter, deleted
records have no index entry.

Keys:

- A numeric key (`ID`, `NUMBER`) is 8 bytes: the number as IEEE 754 double
  in big-endian byte order, with the sign bit inverted for positive numbers
  and all bits inverted for negative ones, so that the keys sort like the
  numbers when compared as bytes.
- A character key is the concatenation of the numbers, each right-aligned in
  11 characters and padded with spaces: 22 or 33 bytes.

### 3.1 Pages

The file consists of pages of 512 bytes. Offsets in the file are always
multiples of 512.

| Page | Content |
|---|---|
| 0 | header of the tag directory |
| 1 | zero |
| 2 | header of the tag |
| 3 | key expression and filter expression of the tag, each ending with a zero byte |
| 4 | the one leaf of the tag directory: the tag name pointing to page 2 |
| 5 and on | the nodes of the tag |

An index of an empty table is 3072 bytes long (pages 0 to 5; page 5 is an
empty leaf).

Header page (pages 0 and 2):

| Offset | Size | Content |
|---|---|---|
| 0 | 4 | file offset of the root node, little endian |
| 4 | 4 | zero (start of the list of free pages) |
| 8 | 4 | page 0 only: a counter, **big endian**, see below; zero in page 2 |
| 12 | 2 | key length: 10 in page 0, 8, 22 or 33 in page 2 |
| 14 | 1 | options: `0xE0` in page 0, `0x68` in page 2 |
| 15 | 1 | `0x01` |
| 502 | 2 | zero (ascending order) |
| 504 | 2 | page 2: length of the key expression with its zero byte; page 0: 1 |
| 506 | 2 | page 2: length of the filter expression with its zero byte (16); page 0: 1 |
| 508 | 2 | zero |
| 510 | 2 | page 2: length of the key expression with its zero byte; page 0: 1 |

The option bits are `0x20` compact index, `0x40` compound index header,
`0x80` tag directory, `0x08` index with a filter.

The counter at offset 8 of page 0 grows as SP5 changes the table. It does
not follow from the content of the table (the sample has tables with no
records and a counter of 194). This library keeps the value it finds when it
rebuilds an index.

### 3.2 Nodes

Every node starts with:

| Offset | Size | Content |
|---|---|---|
| 0 | 2 | attributes: 1 root, 2 leaf, 3 root and leaf, 0 interior node that is not the root |
| 2 | 2 | number of keys in the node |
| 4 | 4 | file offset of the node to the left on the same level, -1 if none |
| 8 | 4 | file offset of the node to the right, -1 if none |

**Leaf.** The header continues:

| Offset | Size | Content |
|---|---|---|
| 12 | 2 | free bytes in the node |
| 14 | 4 | mask for the record number |
| 18 | 1 | mask for the duplicate count |
| 19 | 1 | mask for the trailing count |
| 20 | 1 | bits used for the record number |
| 21 | 1 | bits used for the duplicate count |
| 22 | 1 | bits used for the trailing count |
| 23 | 1 | size of an entry in bytes: 3 |

Entries of three bytes follow from offset 24, one per key in key order. An
entry is a little-endian number that packs, from the low bits up, the record
number, the duplicate count and the trailing count. The duplicate count is
the number of leading bytes the key shares with the previous key in the node
(0 for the first), the trailing count the number of padding bytes cut off at
the end. Only character keys have trailing bytes (spaces) cut off. The
remaining bytes of each key are stored from the end of the page backwards:
the bytes of the first key are the last bytes of the page.

The bits per count depend on the key length: 4 for keys up to 15 bytes, 5 up
to 31 bytes, 6 above. The record number gets the remaining bits of the 24
(16, 14 or 12 bits). Record numbers start at 1. In the tag directory the
"record number" is the file offset of the tag header.

Note: with 16, 14 or 12 bits, record numbers above 65535, 16383 or 4095 do
not fit an entry of three bytes. How SP5 lays out the leaves of larger
tables is *(unknown)*; this library writes the format described here and
refuses nothing, so index files of tables with more records than that
should be deleted rather than rebuilt (see section 7).

**Interior node.** After the 12-byte header, one entry per child node: the
last key of the child (full key length, not compressed), the record number
of that key and the file offset of the child, both as 4-byte **big-endian**
numbers.

A tag that fits one leaf has that leaf as its root (attributes 3). In the
sample only 5HOLID (96 records) needs more: two leaves on pages 5 and 6 and
the root on page 7. Leaves are filled one after the other until the next key
does not fit.

## 4. Conventions shared by many tables

**IDs.** Every table starts with a numeric field `ID`. In the master data
tables (employees, groups, shifts and so on) the `ID` identifies the record.
The other tables belong to an owner (an employee, group, user or cycle) and
number their records per owner: the `ID` is only unique together with the
owner field, and both together form the key. The sample shows this in
5GRASG, where the IDs 1 to 4 repeat for every employee. A reference to a
record that does not exist is written as 0.

**Positions.** `POSITION` is the place of a record in lists the user has
sorted by hand.

**Hiding.** Master data is not deleted but hidden with `HIDE = 1`, so that
older plan entries still find their shift, employee or absence type.

**Colours.** Colours are Windows `COLORREF` numbers stored as decimal
integers: `red + 256 * green + 65536 * blue`. White is 16777215, black 0,
pure red 255, pure blue 16711680. The usual triple is `COLORTEXT` (text),
`COLORBAR` (bar in the plan) and `COLORBK` (background); employees and
groups have `CFGLABEL` (text of the label), `CBKLABEL` (background of the
label) and `CBKSCHED` (background of the row in the plan).

**Day numbers.** Wherever days of the week are counted, 0 is Monday and 6 is
Sunday. A list with eight places has holidays as place 7.

**Day lists.** `WORKDAYS` and `VALIDDAYS` hold one flag per day, each
followed by a space: `1 1 1 1 1 0 0 0 ` means Monday to Friday and not on
holidays. The lists have eight places, except `VALIDDAYS` of 5XCHAR, which
has seven (no holiday place).

**Times of day.** Numeric time fields (`START`, `END`) hold minutes since
midnight, 0 to 1440. An end that is not after the start lies on the next day.

**Working times.** `STARTEND` fields hold up to three time ranges
`HH:MM-HH:MM` separated by a space, for example `08:00-12:00 13:00-17:00`. An
end that is not after the start lies on the next day (`22:00-06:00`); an end
of `00:00` is midnight at the end of the day. An empty field means the shift
does not take place on that day. The hours that count are stored separately
in `DURATION` and are not derived from the ranges.

**Half days.** `INTERVAL` in 5HOLID and 5ABSEN: 0 the whole day, 1 the first
half (until 12:00), 2 the second half *(program; the sample contains only 0)*.

## 5. Tables

For each table: its key (the index key expression in short), its records in
the sample, and the fields. `->` marks a reference to the `ID` of another
table. Field types are written as type and length; `C` fields are text
unless noted.

### 5.1 Master data

#### 5EMPL: employees

Key `ID`. 30 records in the sample.

| Field | Type | Meaning |
|---|---|---|
| ID | N11 | |
| POSITION | N11 | place in the manual sort order |
| NUMBER | C60 | personnel number |
| NAME | C200 | surname |
| FIRSTNAME | C60 | first name |
| SHORTNAME | C60 | short name |
| SALUTATION | C100 | form of address |
| STREET, ZIP, TOWN | C100, C60, C60 | address |
| PHONE, EMAIL | C200 | |
| PHOTO | C200 | file name of a photo *(assumed; empty in the sample)* |
| FUNCTION | C200 | function or job title |
| ARBITR1, ARBITR2, ARBITR3 | C200 | free fields whose meaning the user defines |
| SEX | N5 | 0 not set, 1 male, 2 female *(assumed; the sample has 0 and 1)* |
| BIRTHDAY | D | |
| EMPSTART, EMPEND | D | first and last day of employment, unset means open |
| CALCBASE | N5 | basis of the nominal hours: 0 per day (`HRSDAY` for each working day), 1 per week (`HRSWEEK`), 2 per month (`HRSMONTH`), 3 a total for the whole employment (`HRSTOTAL`) |
| HRSDAY, HRSWEEK, HRSMONTH, HRSTOTAL | F19 | hours per day, week, month and in total |
| WORKDAYS | C16 | day list (single-byte): the days the employee works |
| DEDUCTHOL | N1 | 1: holidays on working days reduce the nominal hours of a week or month |
| CFGLABEL, CBKLABEL, CBKSCHED | N11 | colours |
| BOLD | N1 | 1: shown in bold |
| HIDE | N1 | 1: hidden |
| NOTE1 to NOTE4 | C252 | notes |
| RESERVED | C200 | |

#### 5GROUP: groups

Key `ID`. 10 records. Groups form a tree.

| Field | Type | Meaning |
|---|---|---|
| ID | N11 | |
| NAME, SHORTNAME | C200 | |
| ARBITR | C200 | free field |
| SUPERID | N11 | -> 5GROUP, the parent group; 0 for a group at the top |
| POSITION | N11 | |
| DAILYDEM | C48 | eight numbers, each followed by a space (single-byte): staff needed per day, Monday to Sunday and holidays *(assumed; all zero in the sample)* |
| CFGLABEL, CBKLABEL, CBKSCHED | N11 | colours |
| BOLD, HIDE | N1 | |
| RESERVED | C200 | |

#### 5GRASG: group membership

Key `ID`, `EMPLOYEEID`. 36 records. An employee can be in several groups.

| Field | Type | Meaning |
|---|---|---|
| ID | N11 | counted per employee |
| EMPLOYEEID | N11 | -> 5EMPL |
| GROUPID | N11 | -> 5GROUP |
| RESERVED | C20 | |

#### 5SHIFT: shift types

Key `ID`. 5 records.

| Field | Type | Meaning |
|---|---|---|
| ID | N11 | |
| NAME, SHORTNAME | C200 | |
| POSITION | N11 | |
| COLORTEXT, COLORBAR, COLORBK | N11 | colours |
| BOLD | N1 | |
| STARTEND0 to STARTEND7 | C36 | working times (single-byte) for Monday to Sunday and for holidays |
| DURATION0 to DURATION7 | F19 | hours counted for the same eight days |
| NOEXTRA | N1 | 1: no time surcharges for this shift |
| CATEGORY | N5 | category of the shift *(unknown; 0 in the sample)* |
| HIDE | N1 | |
| RESERVED | C200 | |

#### 5LEAVT: absence types

Key `ID`. 8 records.

| Field | Type | Meaning |
|---|---|---|
| ID | N11 | |
| NAME, SHORTNAME | C200 | |
| POSITION | N11 | |
| COLORTEXT, COLORBAR, COLORBK | N11 | colours |
| BOLD | N1 | |
| CHARGETYP | N5 | how a day of absence counts as working time: 0 not at all, 1 with the hours the employee would have worked, 2 with the fixed hours in `CHARGEHRS` |
| CHARGEHRS | F19 | hours per day for `CHARGETYP` 2 |
| DEDUCTACT | N1 | 1: the hours are deducted from the actual hours instead of added *(program)* |
| DEDUCTOVT | N1 | 1: the hours are deducted from the overtime account *(program)* |
| ENTITLED | N1 | 1: employees have an entitlement for this type (as for vacation) |
| STDENTIT | F19 | standard entitlement per year |
| CARRYFWD | N1 | 1: what is left is carried over to the next year |
| COUNTALL | N1 | 1: every calendar day counts, 0: only the working days of the employee |
| IGNORED | N1 | *(unknown; 0 in the sample)* |
| VALIDDAYS | C16 | day list (single-byte), all set in the sample *(effect unknown)* |
| CATEGORY | N5 | *(unknown; 0 in the sample)* |
| HIDE | N1 | |
| RESERVED | C200 | |

#### 5WOPL: workplaces

Key `ID`. 4 records.

| Field | Type | Meaning |
|---|---|---|
| ID | N11 | |
| NAME, SHORTNAME | C200 | |
| POSITION | N11 | |
| COLORTEXT, COLORBAR, COLORBK | N11 | colours |
| BOLD, HIDE | N1 | |
| RESERVED | C200 | |

#### 5HOLID: holidays

Key `ID`. 96 records: eight holidays for each of twelve years. Every
holiday of every year is its own record.

| Field | Type | Meaning |
|---|---|---|
| ID | N11 | |
| DATE | D | |
| NAME | C200 | |
| INTERVAL | N5 | 0 whole day, 1 first half, 2 second half *(program)* |
| RESERVED | C50 | |

#### 5XCHAR: time surcharges

Key `ID`. 4 records. A surcharge rule counts the working time that falls
into a time window, for example night work.

| Field | Type | Meaning |
|---|---|---|
| ID | N11 | |
| NAME | C200 | |
| POSITION | N11 | |
| START, END | N5 | the time window in minutes since midnight; 1200 to 360 is 20:00 to 06:00 |
| VALIDITY | N5 | 0: valid on the days of the week in `VALIDDAYS`; 1: valid on the date in `DATE` *(program; 0 in the sample)* |
| VALIDDAYS | C14 | day list with seven places (single-byte) |
| HOLRULE | N5 | holidays: 0 no special treatment, 1 only on holidays, 2 not on holidays *(program)* |
| DATE | D | the date for `VALIDITY` 1; holds the text `invalid ` in the sample |
| HIDE | N1 | |
| RESERVED | C200 | |

### 5.2 Shift cycles

A cycle is a repeating pattern of shifts. Employees are assigned to a cycle
from a date on; the resulting duties are not stored but derived every time.

#### 5CYCLE: cycles

Key `ID`. 1 record.

| Field | Type | Meaning |
|---|---|---|
| ID | N11 | |
| NAME | C200 | |
| POSITION | N11 | |
| SIZE | N5 | length of the cycle in the unit below |
| UNIT | N5 | 1: weeks, 0: days |
| HIDE | N1 | |
| RESERVED | C200 | |

#### 5CYENT: cycle entries

Key `ID`, `CYCLEEID`. 15 records.

| Field | Type | Meaning |
|---|---|---|
| ID | N11 | counted per cycle |
| CYCLEEID | N11 | -> 5CYCLE (the field name has the double E) |
| INDEX | N5 | day within the cycle, from 0; in a cycle of weeks 0 is the Monday of the first week and 7 the Monday of the second |
| SHIFTID | N11 | -> 5SHIFT |
| WORKPLACID | N11 | -> 5WOPL, 0 for none |
| RESERVED | C20 | |

Days of the cycle without an entry are free.

#### 5CYASS: assignments of employees to cycles

Key `ID`, `EMPLOYEEID`. No records in the sample.

| Field | Type | Meaning |
|---|---|---|
| ID | N11 | counted per employee |
| EMPLOYEEID | N11 | -> 5EMPL |
| CYCLEID | N11 | -> 5CYCLE |
| START, END | D | first and last day of the assignment; no end means open |
| ENTRANCE | N5 | where in the cycle the employee starts, from 0: the week for a cycle of weeks, the day for a cycle of days *(program)* |
| RESERVED | C20 | |

#### 5CYEXC: exceptions from a cycle

Key `ID`, `EMPLOYEEID`, `CYCLEASSID`. No records in the sample.

| Field | Type | Meaning |
|---|---|---|
| ID | N11 | |
| EMPLOYEEID | N11 | -> 5EMPL |
| CYCLEASSID | N11 | -> 5CYASS (the `ID` of the assignment of that employee) |
| DATE | D | the day on which the duty from the cycle does not apply |
| TYPE | N5 | *(unknown)* |
| RESERVED | C20 | |

### 5.3 The plan

#### 5MASHI: duties

Key `ID`, `EMPLOYEEID`. No records in the sample. One record is one shift of
one employee on one day.

| Field | Type | Meaning |
|---|---|---|
| ID | N11 | counted per employee |
| EMPLOYEEID | N11 | -> 5EMPL |
| DATE | D | |
| SHIFTID | N11 | -> 5SHIFT |
| WORKPLACID | N11 | -> 5WOPL, 0 for none |
| TYPE | N5 | 0: the plan as worked (actual), 1: the plan as intended (nominal) *(program)* |
| RESERVED | C20 | |

#### 5SPSHI: special shifts

Key `ID`, `EMPLOYEEID`. No records in the sample. A special shift is a duty
with its own name, times and colours, entered for one employee and day.

| Field | Type | Meaning |
|---|---|---|
| ID | N11 | counted per employee |
| EMPLOYEEID | N11 | -> 5EMPL |
| DATE | D | |
| NAME, SHORTNAME | C200 | |
| SHIFTID | N11 | -> 5SHIFT if the record changes the working time of a regular shift on that day, 0 for a duty of its own *(program)* |
| WORKPLACID | N11 | -> 5WOPL, 0 for none |
| TYPE | N5 | *(unknown)* |
| COLORTEXT, COLORBAR, COLORBK | N11 | colours |
| BOLD | N1 | |
| STARTEND | C36 | working times (single-byte) |
| DURATION | F19 | hours counted |
| NOEXTRA | N1 | 1: no time surcharges |
| RESERVED | C20 | |

#### 5ABSEN: absences

Key `ID`, `EMPLOYEEID`. No records in the sample. One record per employee
and day; a vacation of a week is five or seven records.

| Field | Type | Meaning |
|---|---|---|
| ID | N11 | counted per employee |
| EMPLOYEEID | N11 | -> 5EMPL |
| DATE | D | |
| LEAVETYPID | N11 | -> 5LEAVT |
| TYPE | N5 | *(unknown)* |
| INTERVAL | N5 | 0 whole day, 1 first half, 2 second half, 3 from `START` to `END` *(program)* |
| START, END | N5 | minutes since midnight, for `INTERVAL` 3 |
| RESERVED | C20 | |

#### 5NOTE: notes

Key `ID`, `EMPLOYEEID`. No records in the sample.

| Field | Type | Meaning |
|---|---|---|
| ID | N11 | counted per employee |
| EMPLOYEEID | N11 | -> 5EMPL, 0 for a note on the day as a whole *(assumed)* |
| DATE | D | |
| TEXT1, TEXT2 | C252 | the text |
| RESERVED | C20 | |

#### 5PERIO: marked periods

Key `ID`, `GROUPID`. No records in the sample.

| Field | Type | Meaning |
|---|---|---|
| ID | N11 | counted per group |
| GROUPID | N11 | -> 5GROUP |
| START, END | D | first and last day |
| COLOR | N11 | colour |
| DESCRIPT | C200 | description |
| RESERVED | C20 | |

### 5.4 Accounts

#### 5OVER: overtime

Key `ID`, `EMPLOYEEID`. No records in the sample.

| Field | Type | Meaning |
|---|---|---|
| ID | N11 | counted per employee |
| EMPLOYEEID | N11 | -> 5EMPL |
| DATE | D | |
| HOURS | F19 | hours, negative for time taken off |
| RESERVED | C20 | |

#### 5BOOK: bookings

Key `ID`, `EMPLOYEEID`. No records in the sample. Manual corrections of an
employee's hour accounts.

| Field | Type | Meaning |
|---|---|---|
| ID | N11 | counted per employee |
| EMPLOYEEID | N11 | -> 5EMPL |
| DATE | D | |
| TYPE | N5 | the account: 0 actual hours, 1 nominal hours, 2 overtime *(program)* |
| VALUE | F19 | hours, may be negative |
| NOTE | C200 | |
| RESERVED | C20 | |

#### 5LEAEN: entitlements

Key `ID`, `EMPLOYEEID`. No records in the sample.

| Field | Type | Meaning |
|---|---|---|
| ID | N11 | counted per employee |
| EMPLOYEEID | N11 | -> 5EMPL |
| YEAR | N11 | |
| LEAVETYPID | N11 | -> 5LEAVT |
| ENTITLEMNT | F19 | entitlement for the year |
| REST | F19 | carried over from the year before |
| INDAYS | N1 | 1: the amounts are days, 0: hours *(program)* |
| RESERVED | C20 | |

### 5.5 Rules and demand

#### 5RESTR: shift restrictions

Key `ID`, `EMPLOYEEID`. No records in the sample. A shift an employee should
not get on a day of the week.

| Field | Type | Meaning |
|---|---|---|
| ID | N11 | counted per employee |
| EMPLOYEEID | N11 | -> 5EMPL |
| WEEKDAY | N5 | day number, 7 for holidays *(program)* |
| SHIFTID | N11 | -> 5SHIFT |
| RESTRICT | N5 | 1: only on request, 2: never *(program)* |
| RESERVED | C20 | |

#### 5HOBAN: vacation bans

Key `ID`, `GROUPID`. No records in the sample.

| Field | Type | Meaning |
|---|---|---|
| ID | N11 | counted per group |
| GROUPID | N11 | -> 5GROUP |
| START, END | D | first and last day |
| RESTRICT | N11 | *(unknown)* |
| DESCRIPT | C200 | description |
| RESERVED | C20 | |

#### 5SHDEM: staff demand per shift and day of the week

Key `ID`, `GROUPID`. No records in the sample.

| Field | Type | Meaning |
|---|---|---|
| ID | N11 | counted per group |
| GROUPID | N11 | -> 5GROUP |
| WEEKDAY | N5 | day number, 7 for holidays *(program)* |
| SHIFTID | N11 | -> 5SHIFT |
| WORKPLACID | N11 | -> 5WOPL, 0 for any |
| MIN, MAX | N5 | fewest and most employees wanted |
| RESERVED | C20 | |

#### 5SPDEM: staff demand on a date

Key `ID`, `GROUPID`. No records in the sample. Like 5SHDEM with a `DATE`
(D) in place of `WEEKDAY`; it replaces the demand of the day of the week.

#### 5DADEM: staff demand per day for a period

Key `ID`, `GROUPID`. No records in the sample.

| Field | Type | Meaning |
|---|---|---|
| ID | N11 | counted per group |
| GROUPID | N11 | -> 5GROUP |
| START | D | first day |
| START | D | last day. The field has the same name as the one before it; the header of the table really contains the name twice. This library calls the second one `START2`. |
| DAILYDEM | C48 | as in 5GROUP *(assumed)* |
| DESCRIPT | C200 | description |
| RESERVED | C20 | |

### 5.6 Users and settings

#### 5USER: users

Key `ID`. 6 records.

| Field | Type | Meaning |
|---|---|---|
| ID | N11 | |
| POSITION | N11 | |
| NAME | C200 | login name |
| DESCRIP | C200 | description |
| ADMIN | N1 | 1: may manage users |
| DIGEST | C16 | binary: MD5 of the password as UTF-16 LE text without terminator. A user without password has the MD5 of the empty input. |
| RIGHTS | N5 | 0: may change everything, 1: may only read, 2: rights per group and employee, see 5GRACC and 5EMACC *(program)* |
| CATEGORY | C40 | twenty flags, each followed by a space (single-byte) *(meaning unknown)* |
| ADDEMPL | N1 | may add employees |
| WDUTIES, WABSENCES, WOVERTIMES, WNOTES | N1 | may change duties, absences, overtime, notes |
| WDEVIATION | N1 | may change working times of single duties |
| WCYCLEASS | N1 | may change cycle assignments |
| WSWAPONLY | N1 | may only swap duties *(assumed)* |
| WPAST | N1 | may change the past |
| WACCEMWND, WACCGRWND | N1 | may change data in the employee and group windows *(assumed)* |
| SHOWABS | N5 | absences of others: 0 shown, 1 shown without their type, 2 not shown *(program)* |
| SHOWNOTES, SHOWSTATS | N1 | sees notes, statistics |
| RACCEMWND, RACCGRWND | N1 | may open the employee and group windows *(assumed)* |
| BACKUP | N1 | may make backups |
| HIDEBARIN, HIDEBARNO | N1 | *(unknown)* |
| ACCVOWND, ACCADMWND | N1 | *(unknown)* |
| MINITABLE | N1 | *(unknown)* |
| REPORT | C40 | twenty flags like `CATEGORY`: the reports the user may print *(assumed)* |
| HIDE | N1 | |
| RESERVED | C200 | |

#### 5GRACC, 5EMACC: rights of a user for a group or an employee

Key `ID`, `USERID`. 3 records in 5GRACC, none in 5EMACC.

| Field | Type | Meaning |
|---|---|---|
| ID | N11 | counted per user |
| USERID | N11 | -> 5USER |
| GROUPID or EMPLOYEEID | N11 | -> 5GROUP in 5GRACC, -> 5EMPL in 5EMACC |
| RIGHTS | N5 | 0 may change, 1 may read, 2 no access *(program)* |
| RESERVED | C20 | |

Rights for a group include its subgroups.

#### 5USETT: settings

Key `ID`. One record with the `ID` 0.

| Field | Type | Meaning |
|---|---|---|
| ID | N11 | 0 |
| LOGIN | N1 | 1: users must log in *(assumed; 0 in the sample)* |
| SPSHCAT, OVERTCAT | N5 | *(unknown)* |
| ANOANAME, ANOASHORT | C200 | name and short name shown for an absence whose type the user may not see |
| ANOACRTXT, ANOACRBAR, ANOACRBK | N11 | its colours |
| ANOABOLD | N1 | |
| BACKUPFR | N1 | *(unknown)* |
| CHANGELOG | N1 | *(unknown; 0 in the sample)* |
| RESERVED | C200 | |

#### 5BUILD: identity of the database

Key `ID`. One record.

| Field | Type | Meaning |
|---|---|---|
| ID | N11 | 1 |
| BUILD | N11 | version of the table layout *(assumed; 1 in the sample)* |
| CHANGE | N11 | *(unknown; 1 in the sample)* |
| CREATIME | C8 | binary: when the database was created, as Windows `FILETIME` (100 ns since 1601, little endian) |
| UUID | C16 | binary: an identifier of the database |
| HELPER | N11 | *(unknown; 0 in the sample)* |
| RESERVED | C200 | |

## 6. Change journals

Every table has a journal `5NAME-L.DBF` with the fields

| Field | Type | Meaning |
|---|---|---|
| NUMBER | N11 | running number, starting at 1 |
| CHANGEID1, CHANGEID2, CHANGEID3 | N11 | the key of the changed record: the values of the key fields in the order of the index key, 0 for unused parts |
| CHANGE | N1 | 1: the record was added or changed, 2: the record was deleted |

and the index tag `NUMBER_TAG` on `NUMBER`. SP5 clients that have the
database open read the journals to notice changes made by other clients.
All journals of the sample are empty. *(program; see section 7 for what was
observed)*

## 7. Writing

What a program must do to change a database so that SP5 keeps working with
it, and how this library does it:

- Append records at the end of the table, before the end-of-file byte, and
  raise the record count in the header. Never reorder records: index
  entries and nothing else refer to record numbers.
- Write every field in the format of section 2.3, numbers for all numeric
  fields and terminated text for all text fields.
- Delete by setting the deletion flag.
- Keep the index in step. The library rebuilds the index file of a table
  after every change. If it cannot, it deletes the file: SP5 creates missing
  index files when it opens the database.
- Add a journal record for every change.
- Do not write while SP5 has the database open. SP5 locks byte ranges of the
  files through CodeBase; this library uses `flock` on POSIX systems, and
  the two do not see each other.

## 8. Not understood

- The fields marked *(unknown)* above: `TYPE` in 5ABSEN, 5SPSHI and 5CYEXC,
  `RESTRICT` in 5HOBAN, `CATEGORY` in 5SHIFT, 5LEAVT and 5USER, `IGNORED`
  and the effect of `VALIDDAYS` in 5LEAVT, `SPSHCAT`, `OVERTCAT`, `BACKUPFR`
  and `CHANGELOG` in 5USETT, `CHANGE` and `HELPER` in 5BUILD, several flags
  in 5USER.
- The counter in the index header.
- Index files of tables with more records than fit the three-byte leaf
  entries.
- Whether the `RESERVED` fields are ever used.
