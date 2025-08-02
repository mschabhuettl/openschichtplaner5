#!/usr/bin/env python3
"""
Test script to verify OpenSchichtplaner5 installation
"""
import sys
from pathlib import Path

# Colors for terminal output
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


def test_basic_imports():
    print_header("Testing Basic Imports")
    
    try:
        sys.path.insert(0, str(Path(__file__).parent / "libopenschichtplaner5" / "src"))
        import libopenschichtplaner5
        print_success("libopenschichtplaner5 imported successfully")
        
        from libopenschichtplaner5 import enhanced_registry
        print_success("Enhanced registry imported successfully")
        
        from libopenschichtplaner5.models.employee import Employee
        print_success("Employee model imported successfully")
        
        return True
    except ImportError as e:
        print_error(f"Import failed: {e}")
        return False


def test_registry_system():
    print_header("Testing Registry System")
    
    try:
        from libopenschichtplaner5 import enhanced_registry
        
        # Check if tables are registered
        plugins = enhanced_registry.plugins
        print_success(f"Registry has {len(plugins)} registered table plugins")
        
        # Check key tables
        key_tables = ['5EMPL', '5GROUP', '5SHIFT', '5ABSEN']
        for table in key_tables:
            if table in plugins:
                print_success(f"Table {table} is registered")
            else:
                print_warning(f"Table {table} is not registered")
        
        return True
    except Exception as e:
        print_error(f"Registry test failed: {e}")
        return False


def test_data_models():
    print_header("Testing Data Models")
    
    try:
        from libopenschichtplaner5.models.employee import Employee
        from libopenschichtplaner5.models.group import Group
        from libopenschichtplaner5.models.shift import Shift
        
        # Test creating model instances with required fields
        employee = Employee(
            id=1, 
            name="Test", 
            firstname="User",
            position="Test Position",
            number="001",
            salutation="Mr",
            street="Test Street",
            zip_code="12345",
            town="Test Town",
            phone="123456789",
            email="test@example.com",
            photo="",
            function="Test Function",
            birthday=None,
            empstart=None,
            empend=None
        )
        print_success("Employee model works")
        
        group = Group(id=1, name="Test Group", shortname="TG", position=1)
        print_success("Group model works")
        
        shift = Shift(id=1, name="Test Shift", shortname="TS", position=1)
        print_success("Shift model works")
        
        return True
    except Exception as e:
        print_error(f"Data model test failed: {e}")
        return False


def test_api_import():
    print_header("Testing API Components")
    
    try:
        sys.path.insert(0, str(Path(__file__).parent / "openschichtplaner5-api" / "src"))
        from openschichtplaner5_api.api import create_api
        print_success("API module imported successfully")
        return True
    except ImportError as e:
        print_error(f"API import failed: {e}")
        return False


def test_webserver_import():
    print_header("Testing Web Server Components")
    
    try:
        sys.path.insert(0, str(Path(__file__).parent / "openschichtplaner5-webserver" / "src"))
        from openschichtplaner5_webserver.main import main
        print_success("Web server module imported successfully")
        return True
    except ImportError as e:
        print_error(f"Web server import failed: {e}")
        return False


def test_cli_import():
    print_header("Testing CLI Components")
    
    try:
        sys.path.insert(0, str(Path(__file__).parent / "openschichtplaner5-cli" / "src"))
        import openschichtplaner5_cli
        print_success("CLI module imported successfully")
        return True
    except ImportError as e:
        print_error(f"CLI import failed: {e}")
        return False


def main():
    print_header("OpenSchichtplaner5 Installation Test")
    
    tests = [
        ("Basic Imports", test_basic_imports),
        ("Registry System", test_registry_system),
        ("Data Models", test_data_models),
        ("API Components", test_api_import),
        ("Web Server", test_webserver_import),
        ("CLI Components", test_cli_import),
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        try:
            if test_func():
                passed += 1
        except Exception as e:
            print_error(f"Test '{test_name}' crashed: {e}")
    
    print_header("Test Results")
    print(f"Passed: {passed}/{total} tests")
    
    if passed == total:
        print_success("All tests passed! ✨")
        print("OpenSchichtplaner5 is correctly installed and ready to use.")
    elif passed >= total * 0.8:
        print_warning("Most tests passed, but some components may have issues.")
    else:
        print_error("Many tests failed. Please check your installation.")
    
    print(f"\n{BLUE}Next steps:{RESET}")
    print("1. Run the web server: ./start_webserver.sh")
    print("2. Open http://localhost:8080 in your browser")
    print("3. Run the demo: python demo.py --dir /path/to/dbf/files")


if __name__ == "__main__":
    main()