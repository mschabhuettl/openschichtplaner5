# OpenSchichtplaner5

A comprehensive Python toolchain for reading, analyzing, and processing Schichtplaner5 database files (DBF format). This project provides a powerful library, command-line interface, and extensive features for working with shift planning data.

## 🚀 Features

### Core Library (`libopenschichtplaner5`)
- **DBF Parser**: Robust parsing of all Schichtplaner5 DBF tables with proper encoding handling
- **Data Models**: Type-safe Python dataclasses for all entities (employees, shifts, groups, etc.)
- **Relationship Management**: Automatic resolution of foreign key relationships between tables
- **Query Engine**: SQL-like query builder with joins, filters, and aggregations
- **Data Validation**: Comprehensive validation of data integrity and business rules
- **Report Generation**: Pre-built reports for common analysis needs
- **Export Capabilities**: Export to CSV, JSON, Excel, HTML, and Markdown formats

### Command-Line Interface (`openschichtplaner5-cli`)
- Employee management and search
- Group and shift analysis
- Custom query builder
- Report generation
- Data validation and export
- Interactive mode for exploration

## 📦 Installation

### Prerequisites
- Python 3.8 or higher
- DBF files from Schichtplaner5

### Basic Installation
```bash
# Clone the repository
git clone https://github.com/mschabhuettl/openschichtplaner5.git
cd openschichtplaner5

# Install dependencies
pip install -r requirements.txt

# Optional: Install Excel support
pip install openpyxl
```

### Development Installation
```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install in development mode
pip install -e libopenschichtplaner5/
pip install -e openschichtplaner5-cli/
```

## 🎯 Quick Start

### Using the CLI

#### Basic Commands
```bash
# Show help
python -m openschichtplaner5_cli --dir /path/to/dbf/files --help

# Search for employees
python -m openschichtplaner5_cli --dir /path/to/dbf employee search "Schmidt"

# Get employee profile with all related data
python -m openschichtplaner5_cli --dir /path/to/dbf employee profile --id 52 --full

# Show employee schedule
python -m openschichtplaner5_cli --dir /path/to/dbf employee schedule --id 52 \
    --start 2024-01-01 --end 2024-01-31
```

#### Advanced Queries
```bash
# Custom query with joins
python -m openschichtplaner5_cli --dir /path/to/dbf query 5EMPL \
    --where position = "Developer" \
    --join 5NOTE \
    --join 5GRASG \
    --limit 10 \
    --format json

# Show table relationships
python -m openschichtplaner5_cli --dir /path/to/dbf relationships --table 5EMPL
```

#### Report Generation
```bash
# Generate absence report
python -m openschichtplaner5_cli --dir /path/to/dbf report absence \
    --employee-id 52 \
    --year 2024 \
    --format html \
    --output absence_report.html

# Group staffing report
python -m openschichtplaner5_cli --dir /path/to/dbf report staffing \
    --group-id 5 \
    --date 2024-01-15 \
    --format markdown

# Shift distribution analysis
python -m openschichtplaner5_cli --dir /path/to/dbf report shifts \
    --start 2024-01-01 \
    --end 2024-01-31 \
    --format json
```

#### Data Export
```bash
# Export employee data to Excel
python -m openschichtplaner5_cli --dir /path/to/dbf export 5EMPL \
    --format excel \
    --output employees.xlsx \
    --limit 100

# Export filtered data to CSV
python -m openschichtplaner5_cli --dir /path/to/dbf export 5ABSEN \
    --where employee_id = 52 \
    --format csv \
    --output employee_absences.csv
```

### Using the Library

```python
from pathlib import Path
from libopenschichtplaner5.query_engine import QueryEngine
from libopenschichtplaner5.reports import ReportGenerator
from libopenschichtplaner5.export import DataExporter, ExportFormat

# Initialize
dbf_dir = Path("/path/to/dbf/files")
engine = QueryEngine(dbf_dir)

# Simple query
employees = (engine.query()
            .select("5EMPL")
            .where("position", "=", "Developer")
            .order_by("name")
            .execute())

for emp in employees.records:
    print(f"{emp.name} {emp.firstname}")

# Complex query with joins
schedule = (engine.query()
           .select("5SPSHI")
           .where_employee(52)
           .join("5SHIFT")
           .join("5WOPL")
           .execute())

# Generate report
report_gen = ReportGenerator(engine)
absence_report = report_gen.employee_absence_report(
    employee_id=52,
    year=2024
)

# Export data
exporter = DataExporter()
exporter.export(
    employees.to_dict(),
    ExportFormat.EXCEL,
    Path("employees.xlsx")
)
```

## 📊 Data Model

### Key Tables
- `5EMPL`: Employees
- `5GROUP`: Groups/Departments
- `5SHIFT`: Shift definitions
- `5SPSHI`: Shift assignments (employee-shift-date)
- `5ABSEN`: Absences
- `5LEAVT`: Leave types
- `5WOPL`: Work locations
- `5NOTE`: Notes
- `5CYASS`: Cycle assignments
- `5USER`: System users

### Relationships
The system automatically resolves relationships between tables:
- Employee → Groups (via 5GRASG)
- Employee → Shifts (via 5SPSHI)
- Employee → Absences (via 5ABSEN)
- Shifts → Work Locations (via 5WOPL)
- And many more...

## 🛠 Advanced Features

### Data Validation
```bash
# Validate all data
python -m openschichtplaner5_cli --dir /path/to/dbf validate

# The validation checks:
# - Required fields
# - Data types
# - Foreign key constraints
# - Business rules (overlapping shifts, etc.)
```

### Custom Query Builder
The query engine supports:
- Multiple filter conditions
- Joins between related tables
- Ordering and pagination
- Aggregations
- Date range queries

### Report Templates
Pre-built reports include:
- Employee absence summaries
- Group staffing levels
- Shift distribution analysis
- Overtime calculations
- Cycle assignment overviews

## 🧪 Running the Demo

```bash
# Run comprehensive demo
python demo.py --dir /path/to/dbf/files

# Run interactive demo
python demo.py --dir /path/to/dbf/files --interactive
```

## 📁 Project Structure

```
openschichtplaner5/
├── libopenschichtplaner5/          # Core library
│   └── src/
│       └── libopenschichtplaner5/
│           ├── models/             # Data models for each table
│           ├── db/                 # DBF reading utilities
│           ├── utils/              # Helper functions
│           ├── registry.py         # Table registry
│           ├── relationships.py    # Relationship management
│           ├── query_engine.py     # Query builder
│           ├── reports.py          # Report generation
│           └── export.py           # Export functionality
├── openschichtplaner5-cli/         # CLI application
│   └── src/
│       └── openschichtplaner5_cli/
│           ├── __main__.py         # Entry point
│           └── enhanced_cli.py     # CLI implementation
├── openschichtplaner5-gui/         # GUI (planned)
├── demo.py                         # Demonstration script
└── requirements.txt                # Dependencies
```

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## ⚠️ Disclaimer

This is an independent project and is not affiliated with or endorsed by the creators of Schichtplaner5. Use at your own risk and ensure compliance with your organization's data policies.

## 🚧 Roadmap

- [ ] GUI application
- [ ] Additional report templates
- [ ] Data import capabilities
- [ ] API server mode
- [ ] Performance optimizations for large datasets
- [ ] Automated testing suite
- [ ] Docker containerization
- [ ] Plugin system for custom reports

## 📞 Support

For issues, questions, or contributions:
- Open an issue on GitHub
- Check the documentation
- Run the demo script for examples
