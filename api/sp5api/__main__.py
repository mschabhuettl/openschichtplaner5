"""Run the API server: ``sp5api /path/to/data`` or ``python -m sp5api``."""

import argparse
import os

import uvicorn

from .app import create_app


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="sp5api", description=__doc__)
    parser.add_argument("db_path", nargs="?", default=os.environ.get("SP5_DB_PATH"))
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument(
        "--write", action="store_true", help="enable the write endpoints (SP5_READONLY=0)"
    )
    args = parser.parse_args(argv)
    if not args.db_path:
        parser.error("give the database directory or set SP5_DB_PATH")
    app = create_app(args.db_path, readonly=False if args.write else None)
    uvicorn.run(app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
