# OpenSchichtplaner5

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.68+-green.svg)](https://fastapi.tiangolo.com/)

A comprehensive, modern Python toolchain for reading, analyzing, and processing **Schichtplaner5** database files (DBF format). OpenSchichtplaner5 transforms legacy DBF-based schedule data into powerful, web-based workforce management tools.

## 🚀 Quick Start

```bash
# Clone the repository with all submodules
git clone --recurse-submodules https://github.com/your-org/openschichtplaner5.git
cd openschichtplaner5

# Set up development environment
./setup_env.sh

# Install dependencies
pip install -r requirements.txt

# Start the web server
python -m openschichtplaner5_webserver.main --dir /path/to/your/dbf/files --port 8080
```

Open your browser to `http://localhost:8080` and explore your schedule data!

## 📋 Features

### 🌐 **Modern Web Interface**
- **Responsive Dashboard**: State-of-the-art interface that works on all devices
- **Real-time Schedule Views**: Dienstplan, Einsatzplan, and Jahresübersicht
- **Interactive Analytics**: Comprehensive workforce intelligence and insights
- **Direct URLs**: `/schichtplan/dienstplan`, `/schichtplan/einsatzplan`, `/schichtplan/jahresplan`

### 📊 **Powerful Analytics**
- **Workforce Intelligence**: Employee utilization, overtime analysis, and capacity planning
- **Predictive Analytics**: Forecast staffing needs and identify patterns
- **Financial Analytics**: Cost analysis and budget optimization
- **Operational Insights**: Schedule efficiency and coverage analysis

### 🔧 **Developer-Friendly**
- **REST API**: Comprehensive API with OpenAPI documentation
- **Multiple Export Formats**: CSV, JSON, Excel, HTML, Markdown
- **Type Safety**: Full Python type hints throughout
- **Extensible Architecture**: Modular design for easy customization

### 📈 **Enterprise Ready**
- **High Performance**: Handles 40,000+ records efficiently
- **Data Integrity**: Comprehensive validation and integrity checks
- **Security**: Role-based access control and data protection
- **Scalability**: Async architecture with optimized database queries

## 🏗️ Architecture

OpenSchichtplaner5 follows a modular architecture with clear separation of concerns:

```
openschichtplaner5/
├── libopenschichtplaner5/     # Core library and data models
├── openschichtplaner5-cli/    # Command-line interface
├── openschichtplaner5-api/    # REST API server
├── openschichtplaner5-gui/    # Desktop GUI (planned)
└── openschichtplaner5-webserver/  # Web server and frontend
```

### Core Components

- **📚 libopenschichtplaner5**: Core library with DBF parsing, data models, query engine, and business logic
- **🖥️ openschichtplaner5-cli**: Interactive command-line interface for data exploration
- **🔌 openschichtplaner5-api**: FastAPI-based REST API with comprehensive endpoints
- **🌐 openschichtplaner5-webserver**: Web server with modern dashboard interface
- **🖱️ openschichtplaner5-gui**: Desktop GUI application (future implementation)

## 📦 Installation

### Prerequisites

- **Python 3.8+**
- **Git** (for submodule management)
- **Modern web browser** (Chrome, Firefox, Safari, Edge)

### Development Setup

```bash
# Clone with submodules
git clone --recurse-submodules https://github.com/your-org/openschichtplaner5.git
cd openschichtplaner5

# Initialize development environment
./setup_env.sh

# Or manually:
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### Production Deployment

```bash
# Install in production environment
pip install -r requirements.txt

# Start web server with your DBF directory
python -m openschichtplaner5_webserver.main \
    --dir /path/to/schichtplaner5/data \
    --host 0.0.0.0 \
    --port 8080 \
    --workers 4
```

## 🚀 Usage

### Web Interface

Start the web server and access the modern dashboard:

```bash
python -m openschichtplaner5_webserver.main --dir /path/to/dbf/files --port 8080
```

**Available URLs:**
- `http://localhost:8080/` - Main dashboard
- `http://localhost:8080/schichtplan/dienstplan` - Employee schedule view
- `http://localhost:8080/schichtplan/einsatzplan` - Shift-based schedule view  
- `http://localhost:8080/schichtplan/jahresplan` - Annual overview
- `http://localhost:8080/analytics` - Advanced analytics dashboard
- `http://localhost:8080/api/docs` - Interactive API documentation

### Command Line Interface

Explore your data interactively:

```bash
# Interactive shell
python -m openschichtplaner5_cli --dir /path/to/dbf/files --interactive

# Quick data overview
python -m openschichtplaner5_cli --dir /path/to/dbf/files --summary

# Export data
python -m openschichtplaner5_cli --dir /path/to/dbf/files --export csv --output data_export.csv
```

### API Access

```python
import requests

# Get all employees
response = requests.get("http://localhost:8080/api/employees")
employees = response.json()

# Get schedule for specific period
response = requests.get(
    "http://localhost:8080/api/schedule/dienstplan-range",
    params={"start_date": "2025-01-01", "end_date": "2025-01-31"}
)
schedule = response.json()
```

## 📖 Documentation

### Database Reference
- **[DBF Tables Reference](DBF_TABLES_REFERENCE.md)**: Quick reference guide for all 30 Schichtplaner5 database tables
- **[Comprehensive DBF Analysis](COMPREHENSIVE_DBF_ANALYSIS_REPORT.md)**: Complete technical analysis of the database structure
- **[Code Review Report](COMPREHENSIVE_CODE_REVIEW.md)**: Complete code quality assessment and improvement recommendations

### API Documentation
- **Interactive Docs**: `http://localhost:8080/api/docs` (when server is running)
- **OpenAPI Spec**: `http://localhost:8080/api/openapi.json`

### Development Guides
- **[Contributing](CONTRIBUTING.md)**: Development setup and contribution guidelines
- **[Architecture](docs/architecture.md)**: System design and component interaction
- **[Deployment](docs/deployment.md)**: Production deployment strategies

## 🧪 Testing

```bash
# Run all tests
pytest

# Test specific modules
pytest tests/test_registry.py
pytest tests/test_relationships.py

# Coverage report
pytest --cov=libopenschichtplaner5 --cov-report=html
```

## 🔧 Configuration

### Environment Variables

```bash
# Optional configuration
export OPENSCHICHTPLANER_LOG_LEVEL=INFO
export OPENSCHICHTPLANER_CACHE_SIZE=1000
export OPENSCHICHTPLANER_DB_ENCODING=cp1252
```

### Advanced Configuration

Create a `config.yaml` file:

```yaml
database:
  encoding: cp1252
  cache_size: 1000
  
server:
  host: "0.0.0.0"
  port: 8080
  workers: 4
  
logging:
  level: INFO
  format: "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** your changes: `git commit -m 'Add amazing feature'`
4. **Push** to the branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request

### Code Standards

- **Type Hints**: All code must include comprehensive type hints
- **Documentation**: Docstrings for all public functions and classes
- **Testing**: Unit tests for new functionality
- **Code Style**: Follow PEP 8 and use Black for formatting

## 📊 Database Support

OpenSchichtplaner5 supports the complete **Schichtplaner5** database schema:

### Core Tables
- **5EMPL**: Employee master data
- **5GROUP**: Organizational groups
- **5SHIFT**: Shift definitions
- **5SPSHI**: Shift assignments
- **5ABSEN**: Absence management

### Advanced Features
- **Relationship Resolution**: Automatic foreign key relationship mapping
- **Data Validation**: Comprehensive integrity checks and business rule validation
- **Performance Optimization**: Streaming capabilities for large datasets
- **Multi-format Export**: CSV, JSON, Excel, HTML, Markdown support

## 🌟 Advanced Features

### Query Engine
```python
from libopenschichtplaner5 import QueryEngine

engine = QueryEngine("/path/to/dbf/files")

# Fluent query interface
results = (engine
    .employees()
    .filter("department", "=", "Human Resources")
    .join("shifts")
    .where("date", "between", ["2025-01-01", "2025-01-31"])
    .order_by("lastname")
    .limit(50)
    .execute())
```

### Analytics Engine
```python
from libopenschichtplaner5 import AnalyticsEngine

analytics = AnalyticsEngine("/path/to/dbf/files")

# Generate comprehensive reports
workforce_report = analytics.workforce_intelligence()
capacity_analysis = analytics.capacity_planning(months=6)
cost_breakdown = analytics.financial_analysis(year=2025)
```

## 📈 Performance

OpenSchichtplaner5 is optimized for real-world usage:

- **Fast DBF Reading**: Optimized DBF parsing with memory-efficient streaming
- **Relationship Caching**: Intelligent caching of foreign key relationships
- **Async Architecture**: Non-blocking web interface with responsive user experience
- **Database Optimization**: Efficient queries and pagination for large datasets


## 🛠️ Troubleshooting

### Common Issues

**DBF Encoding Problems**
```bash
# Try different encodings
python -m openschichtplaner5_cli --dir /path/to/dbf --encoding cp1252
python -m openschichtplaner5_cli --dir /path/to/dbf --encoding iso-8859-1
```

**Memory Issues with Large Datasets**
```bash
# Use streaming mode
python -m openschichtplaner5_cli --dir /path/to/dbf --streaming --chunk-size 1000
```

**Web Interface Not Loading**
- Check firewall settings for port 8080
- Ensure DBF directory is accessible
- Verify Python dependencies are installed

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **DBF Format**: Thanks to the dbfread library for reliable DBF parsing
- **Web Framework**: Built with FastAPI for modern, high-performance API
- **Frontend**: Modern responsive design with Tailwind CSS
- **Analytics**: Powered by NumPy and advanced statistical analysis

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-org/openschichtplaner5/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/openschichtplaner5/discussions)
- **Documentation**: [Project Wiki](https://github.com/your-org/openschichtplaner5/wiki)

---

**OpenSchichtplaner5** - Transforming legacy workforce data into modern, actionable insights. 🚀