#!/usr/bin/env python3
"""
Test-Skript zur Überprüfung der OpenSchichtplaner5 Installation
"""
import sys
from pathlib import Path

# Farben für Terminal-Output
RED = '\033[91m'
GREEN = '\033[92m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'


def print_header(text):
    print(f"\n{BLUE}{'=' * 60}{RESET}")
    print(f"{BLUE}{text}{RESET}")
    print(f"{BLUE}{'=' * 60}{RESET}")


def print_success(text):
    print(f"{GREEN}✓ {text}{RESET}")


def print_error(text):
    print(f"{RED}✗ {text}{RESET}")


def print_warning(text):
    print(f"{YELLOW}⚠ {text}{RESET}")


def main():
    print_header("OpenSchichtplaner5 - System Check")

    errors = []
    warnings = []

    # 1. Check Python Version
    print("\n1. Python Version:")
    if sys.version_info >= (3, 8):
        print_success(f"Python {sys.version.split()[0]} (>= 3.8)")
    else:
        print_error(f"Python {sys.version.split()[0]} (< 3.8 required)")
        errors.append("Python version too old")

    # 2. Check Library Path
    print("\n2. Library Path:")
    lib_path = Path(__file__).parent / "libopenschichtplaner5" / "src"
    if lib_path.exists():
        print_success(f"Library path exists: {lib_path}")
        sys.path.insert(0, str(lib_path))
    else:
        print_error(f"Library path not found: {lib_path}")
        errors.append("Library path not found")
        return

    # 3. Check Core Imports
    print("\n3. Core Imports:")
    try:
        from libopenschichtplaner5.registry import TABLE_REGISTRY, TABLE_NAMES
        print_success(f"Registry loaded: {len(TABLE_NAMES)} tables registered")
    except Exception as e:
        print_error(f"Registry import failed: {e}")
        errors.append("Registry import failed")

    try:
        from libopenschichtplaner5.db.reader import DBFTable
        print_success("DBFTable reader imported")
    except Exception as e:
        print_error(f"DBFTable import failed: {e}")
        errors.append("DBFTable import failed")

    try:
        from libopenschichtplaner5.utils.strings import normalize_string
        print_success("String utilities imported")
    except Exception as e:
        print_error(f"String utilities import failed: {e}")
        errors.append("String utilities import failed")

    # 4. Check Model Imports
    print("\n4. Model Imports:")
    models_to_check = [
        "employee", "shift", "absence", "leave_type", "employee_shift",
        "shift_detail", "note", "book", "user", "overtime", "xchar"
    ]

    for model_name in models_to_check:
        try:
            module = __import__(f"libopenschichtplaner5.models.{model_name}",
                                fromlist=[model_name])
            print_success(f"Model '{model_name}' imported")
        except ImportError as e:
            if model_name in ["overtime", "xchar"]:
                print_warning(f"Model '{model_name}' not found (optional)")
                warnings.append(f"Optional model '{model_name}' missing")
            else:
                print_error(f"Model '{model_name}' import failed: {e}")
                errors.append(f"Model '{model_name}' import failed")

    # 5. Check Dependencies
    print("\n5. Dependencies:")
    try:
        import dbfread
        print_success("dbfread installed")
    except ImportError:
        print_error("dbfread not installed (pip install dbfread)")
        errors.append("dbfread not installed")

    try:
        import openpyxl
        print_success("openpyxl installed (Excel support)")
    except ImportError:
        print_warning("openpyxl not installed (optional for Excel export)")
        warnings.append("openpyxl not installed")

    # 6. Check CLI
    print("\n6. CLI Check:")
    cli_path = Path(__file__).parent / "openschichtplaner5-cli" / "src"
    if cli_path.exists():
        sys.path.insert(0, str(cli_path))
        try:
            from openschichtplaner5_cli.enhanced_cli import EnhancedCLI
            print_success("CLI module imported")
        except Exception as e:
            print_error(f"CLI import failed: {e}")
            errors.append("CLI import failed")
    else:
        print_warning("CLI path not found")
        warnings.append("CLI not found")

    # 7. Check DBF Files
    print("\n7. DBF Files:")
    dbf_dir = Path("./dbf_files")
    if dbf_dir.exists():
        dbf_files = list(dbf_dir.glob("*.txt")) + list(dbf_dir.glob("*.DBF"))
        if dbf_files:
            print_success(f"Found {len(dbf_files)} DBF files")
            # Test loading one file
            if TABLE_NAMES:
                test_file = dbf_files[0]
                try:
                    from libopenschichtplaner5.db.reader import DBFTable
                    reader = DBFTable(test_file)
                    records = list(reader.records())
                    print_success(f"Test load successful: {len(records)} records")
                except Exception as e:
                    print_error(f"Test load failed: {e}")
                    errors.append("DBF loading failed")
        else:
            print_warning("No DBF files found in ./dbf_files")
            warnings.append("No DBF files to test")
    else:
        print_warning("DBF directory './dbf_files' not found")
        warnings.append("DBF directory not found")

    # Summary
    print_header("Summary")
    print(f"\nErrors:   {len(errors)}")
    print(f"Warnings: {len(warnings)}")

    if errors:
        print(f"\n{RED}System has errors that need to be fixed:{RESET}")
        for error in errors:
            print(f"  - {error}")

    if warnings:
        print(f"\n{YELLOW}Warnings (optional fixes):{RESET}")
        for warning in warnings:
            print(f"  - {warning}")

    if not errors:
        print(f"\n{GREEN}✓ System is ready to use!{RESET}")
        print("\nNext steps:")
        print("1. Place your DBF files in ./dbf_files/")
        print("2. Run: python -m openschichtplaner5_cli --dir ./dbf_files --help")
    else:
        print(f"\n{RED}✗ Please fix the errors before continuing.{RESET}")

    return len(errors)


if __name__ == "__main__":
    sys.exit(main())