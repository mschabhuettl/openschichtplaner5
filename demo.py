# demo.py - Place this in the root directory of the openschichtplaner5 project
"""
Comprehensive demo script showing all features of OpenSchichtplaner5.
This demonstrates the full capabilities of the library, CLI, and various modules.
"""

import sys
from pathlib import Path
from datetime import date, datetime, timedelta
import json

# Add library paths
sys.path.insert(0, str(Path(__file__).parent / "libopenschichtplaner5" / "src"))
sys.path.insert(0, str(Path(__file__).parent / "openschichtplaner5-cli" / "src"))

from libopenschichtplaner5.query_engine import QueryEngine, FilterOperator
from libopenschichtplaner5.relationships import relationship_manager, get_entity_with_relations
from libopenschichtplaner5.reports import ReportGenerator
from libopenschichtplaner5.export import DataExporter, ReportExporter, ExportFormat
from libopenschichtplaner5.utils.validation import DataValidator, DataCleaner
from libopenschichtplaner5.registry import TABLE_NAMES


class OpenSchichtplaner5Demo:
    """Demonstration of OpenSchichtplaner5 capabilities."""
    
    def __init__(self, dbf_dir: Path):
        self.dbf_dir = dbf_dir
        print(f"Initializing OpenSchichtplaner5 Demo with data from: {dbf_dir}")
        
        # Initialize components
        self.engine = QueryEngine(dbf_dir)
        self.report_generator = ReportGenerator(self.engine)
        self.data_exporter = DataExporter()
        self.report_exporter = ReportExporter()
        self.validator = DataValidator()
        
        print(f"Loaded {len(self.engine.loaded_tables)} tables")
        print(f"Available tables: {', '.join(sorted(self.engine.loaded_tables.keys()))}")
        print()
    
    def run_all_demos(self):
        """Run all demonstration features."""
        print("=" * 80)
        print("OpenSchichtplaner5 - Comprehensive Feature Demo")
        print("=" * 80)
        print()
        
        # 1. Basic queries
        self.demo_basic_queries()
        
        # 2. Advanced queries with relationships
        self.demo_relationship_queries()
        
        # 3. Report generation
        self.demo_reports()
        
        # 4. Data validation
        self.demo_validation()
        
        # 5. Data export
        self.demo_export()
        
        # 6. Complex analysis
        self.demo_complex_analysis()
        
        print("\n" + "=" * 80)
        print("Demo completed!")
        print("=" * 80)
    
    def demo_basic_queries(self):
        """Demonstrate basic query capabilities."""
        print("\n1. BASIC QUERY DEMONSTRATIONS")
        print("-" * 40)
        
        # List all employees
        print("\n1.1 Listing first 5 employees:")
        employees = (self.engine.query()
                    .select("5EMPL")
                    .order_by("name")
                    .limit(5)
                    .execute())
        
        for emp in employees.records:
            print(f"  - [{emp.id}] {emp.name} {emp.firstname} ({emp.position})")
        
        # Search employees
        print("\n1.2 Searching for employees with 'Schmidt' in name:")
        search_results = self.engine.search_employees("Schmidt")
        print(f"  Found {len(search_results)} employees")
        for emp in search_results[:3]:
            print(f"  - {emp['name']} {emp['firstname']}")
        
        # Count shifts by type
        print("\n1.3 Counting shifts by type:")
        shifts = self.engine.query().select("5SHIFT").execute()
        print(f"  Total shift types: {len(shifts.records)}")
        for shift in shifts.records[:5]:
            print(f"  - {shift.name} ({shift.shortname})")
    
    def demo_relationship_queries(self):
        """Demonstrate relationship and join capabilities."""
        print("\n\n2. RELATIONSHIP QUERY DEMONSTRATIONS")
        print("-" * 40)
        
        # Find an employee with data
        print("\n2.1 Finding employee with most data entries:")
        
        # Get employee with notes
        notes_query = (self.engine.query()
                      .select("5NOTE")
                      .limit(1)
                      .execute())
        
        if notes_query.records:
            employee_id = notes_query.records[0].employee_id
            print(f"  Using employee ID: {employee_id}")
            
            # Get full profile
            print("\n2.2 Loading complete employee profile:")
            profile = self.engine.get_employee_full_profile(employee_id)
            
            if profile:
                print(f"  Employee: {profile['name']} {profile['firstname']}")
                print(f"  Position: {profile.get('position', 'N/A')}")
                
                # Show related data counts
                for key in profile:
                    if key.endswith('_related'):
                        table_name = key.replace('_related', '')
                        if isinstance(profile[key], list):
                            print(f"  {table_name}: {len(profile[key])} records")
                        else:
                            print(f"  {table_name}: 1 record")
            
            # Get schedule
            print("\n2.3 Loading employee schedule for current month:")
            today = date.today()
            start_date = today.replace(day=1)
            end_date = (start_date + timedelta(days=32)).replace(day=1) - timedelta(days=1)
            
            schedule = self.engine.get_employee_schedule(employee_id, start_date, end_date)
            print(f"  Found {len(schedule)} schedule entries")
            for entry in schedule[:3]:
                shift_info = entry.get('5SHIFT_related', {})
                print(f"  - {entry.get('date')}: {shift_info.get('name', 'Unknown')}")
        
        # Show relationship graph
        print("\n2.4 Relationship overview:")
        print("  Key relationships defined:")
        sample_tables = ["5EMPL", "5GROUP", "5SHIFT"]
        for table in sample_tables:
            related = relationship_manager.get_all_related_tables(table)
            if related:
                print(f"  - {table} connects to: {', '.join(sorted(related))}")
    
    def demo_reports(self):
        """Demonstrate report generation."""
        print("\n\n3. REPORT GENERATION DEMONSTRATIONS")
        print("-" * 40)
        
        # Find suitable data for reports
        employees = self.engine.query().select("5EMPL").limit(1).execute()
        if not employees.records:
            print("  No employees found for report demo")
            return
        
        employee = employees.records[0]
        employee_id = employee.id
        
        # Absence report
        print(f"\n3.1 Generating absence report for {employee.name} {employee.firstname}:")
        try:
            absence_report = self.report_generator.employee_absence_report(
                employee_id, 
                datetime.now().year
            )
            print(f"  Report: {absence_report.title}")
            print(f"  Total absence days: {absence_report.data['summary']['total_absence_days']}")
            print(f"  Leave types used: {absence_report.data['summary']['leave_types_used']}")
        except Exception as e:
            print(f"  Could not generate absence report: {e}")
        
        # Group staffing report
        print("\n3.2 Generating group staffing report:")
        groups = self.engine.query().select("5GROUP").limit(1).execute()
        if groups.records:
            group = groups.records[0]
            try:
                staffing_report = self.report_generator.group_staffing_report(
                    group.id,
                    date.today()
                )
                print(f"  Report: {staffing_report.title}")
                staffing = staffing_report.data['staffing']
                print(f"  Total members: {staffing['total_members']}")
                print(f"  Working today: {staffing['working']}")
                print(f"  Absent today: {staffing['absent']}")
            except Exception as e:
                print(f"  Could not generate staffing report: {e}")
        
        # Shift distribution
        print("\n3.3 Generating shift distribution report:")
        start_date = date.today() - timedelta(days=30)
        end_date = date.today()
        
        try:
            shift_report = self.report_generator.shift_distribution_report(
                start_date, 
                end_date
            )
            print(f"  Report: {shift_report.title}")
            print(f"  Total shifts analyzed: {shift_report.data['total_shifts']}")
            print(f"  Unique shift types: {len(shift_report.data['shift_types'])}")
            
            if shift_report.data['most_common_shift']:
                shift_name, count = shift_report.data['most_common_shift']
                print(f"  Most common shift: {shift_name} ({count} times)")
        except Exception as e:
            print(f"  Could not generate shift distribution report: {e}")
    
    def demo_validation(self):
        """Demonstrate data validation."""
        print("\n\n4. DATA VALIDATION DEMONSTRATIONS")
        print("-" * 40)
        
        print("\n4.1 Running comprehensive data validation:")
        validation_report = self.validator.validate_all_tables(self.engine.loaded_tables)
        
        print(f"\n{validation_report.summary()}")
        
        # Show sample errors
        if validation_report.errors:
            print("\n4.2 Sample validation errors:")
            for error in validation_report.errors[:5]:
                print(f"  - {error}")
        
        if validation_report.warnings:
            print("\n4.3 Sample validation warnings:")
            for warning in validation_report.warnings[:5]:
                print(f"  - {warning}")
        
        # Data cleaning example
        print("\n4.4 Data cleaning example:")
        employees = self.engine.query().select("5EMPL").limit(1).execute()
        if employees.records:
            emp = employees.records[0]
            print(f"  Original email: '{emp.email}'")
            
            # Clean the record
            cleaned = DataCleaner.clean_record(emp, "5EMPL")
            print(f"  Cleaned email: '{cleaned.email}'")
    
    def demo_export(self):
        """Demonstrate data export capabilities."""
        print("\n\n5. DATA EXPORT DEMONSTRATIONS")
        print("-" * 40)
        
        # Get sample data
        employees = self.engine.query().select("5EMPL").limit(10).execute()
        export_data = employees.to_dict()
        
        # Create export directory
        export_dir = Path("demo_exports")
        export_dir.mkdir(exist_ok=True)
        
        print("\n5.1 Exporting employee data to various formats:")
        
        # CSV export
        csv_path = export_dir / "employees.csv"
        self.data_exporter.export(export_data, ExportFormat.CSV, csv_path)
        print(f"  ✓ CSV exported to: {csv_path}")
        
        # JSON export
        json_path = export_dir / "employees.json"
        self.data_exporter.export(export_data, ExportFormat.JSON, json_path)
        print(f"  ✓ JSON exported to: {json_path}")
        
        # HTML export
        html_path = export_dir / "employees.html"
        self.data_exporter.export(
            export_data, 
            ExportFormat.HTML, 
            html_path,
            title="Employee List"
        )
        print(f"  ✓ HTML exported to: {html_path}")
        
        # Markdown export
        md_path = export_dir / "employees.md"
        self.data_exporter.export(
            export_data, 
            ExportFormat.MARKDOWN, 
            md_path,
            title="Employee List"
        )
        print(f"  ✓ Markdown exported to: {md_path}")
        
        # Excel export (if available)
        try:
            excel_path = export_dir / "employees.xlsx"
            self.data_exporter.export(export_data, ExportFormat.EXCEL, excel_path)
            print(f"  ✓ Excel exported to: {excel_path}")
        except ImportError:
            print("  ℹ Excel export not available (install openpyxl)")
        
        # Report export
        print("\n5.2 Exporting formatted report:")
        if employees.records:
            employee_id = employees.records[0].id
            schedule = self.engine.get_employee_schedule(employee_id)
            
            if schedule:
                schedule_path = export_dir / "employee_schedule.html"
                schedule_html = self.report_exporter.export_employee_schedule(
                    schedule[:20],  # Limit to 20 entries
                    f"{employees.records[0].name} {employees.records[0].firstname}",
                    ExportFormat.HTML
                )
                schedule_path.write_text(schedule_html, encoding='utf-8')
                print(f"  ✓ Schedule report exported to: {schedule_path}")
    
    def demo_complex_analysis(self):
        """Demonstrate complex analysis capabilities."""
        print("\n\n6. COMPLEX ANALYSIS DEMONSTRATIONS")
        print("-" * 40)
        
        # Analyze employee workload
        print("\n6.1 Analyzing employee workload distribution:")
        
        # Get shifts for last 30 days
        end_date = date.today()
        start_date = end_date - timedelta(days=30)
        
        shifts = (self.engine.query()
                 .select("5SPSHI")
                 .where_date_range("date", start_date, end_date)
                 .execute())
        
        # Count shifts per employee
        from collections import Counter
        employee_shifts = Counter()
        for shift in shifts.records:
            employee_shifts[shift.employee_id] += 1
        
        # Show top 5 busiest employees
        print("  Top 5 employees by shift count:")
        for emp_id, count in employee_shifts.most_common(5):
            emp = (self.engine.query()
                  .select("5EMPL")
                  .where("id", "=", emp_id)
                  .execute())
            if emp.records:
                print(f"  - {emp.records[0].name} {emp.records[0].firstname}: {count} shifts")
        
        # Analyze absence patterns
        print("\n6.2 Analyzing absence patterns:")
        
        absences = (self.engine.query()
                   .select("5ABSEN")
                   .where_date_range("date", start_date, end_date)
                   .join("5LEAVT")
                   .execute())
        
        # Count by leave type
        leave_type_counts = Counter()
        for absence in absences.records:
            if isinstance(absence, dict):
                leave_data = absence["_relations"].get("5LEAVT", [])
                if leave_data:
                    leave_type_counts[leave_data[0].name] += 1
        
        print("  Absence types in last 30 days:")
        for leave_type, count in leave_type_counts.most_common():
            print(f"  - {leave_type}: {count} occurrences")
        
        # Group analysis
        print("\n6.3 Analyzing group compositions:")
        
        group_assignments = self.engine.query().select("5GRASG").execute()
        group_sizes = Counter()
        for assignment in group_assignments.records:
            group_sizes[assignment.group_id] += 1
        
        print("  Group sizes:")
        for group_id, size in group_sizes.most_common(5):
            group = (self.engine.query()
                    .select("5GROUP")
                    .where("id", "=", group_id)
                    .execute())
            if group.records:
                print(f"  - {group.records[0].name}: {size} members")
    
    def interactive_menu(self):
        """Run an interactive menu for exploring data."""
        while True:
            print("\n" + "=" * 60)
            print("OpenSchichtplaner5 Interactive Demo")
            print("=" * 60)
            print("1. Run all demos")
            print("2. Search employee")
            print("3. Generate report")
            print("4. Export data")
            print("5. Validate data")
            print("6. Show relationships")
            print("0. Exit")
            print("-" * 60)
            
            choice = input("Select option: ").strip()
            
            if choice == "0":
                break
            elif choice == "1":
                self.run_all_demos()
            elif choice == "2":
                self._interactive_search()
            elif choice == "3":
                self._interactive_report()
            elif choice == "4":
                self._interactive_export()
            elif choice == "5":
                self.demo_validation()
            elif choice == "6":
                self._show_relationships()
            else:
                print("Invalid option")
            
            input("\nPress Enter to continue...")
    
    def _interactive_search(self):
        """Interactive employee search."""
        search_term = input("Enter search term: ").strip()
        if search_term:
            results = self.engine.search_employees(search_term)
            print(f"\nFound {len(results)} employees:")
            for emp in results:
                print(f"  [{emp['id']}] {emp['name']} {emp['firstname']} - {emp.get('position', 'N/A')}")
    
    def _interactive_report(self):
        """Interactive report generation."""
        print("\nAvailable reports:")
        print("1. Employee absence report")
        print("2. Group staffing report")
        print("3. Shift distribution report")
        
        report_choice = input("Select report: ").strip()
        
        if report_choice == "1":
            emp_id = input("Enter employee ID: ").strip()
            year = input("Enter year (or press Enter for current): ").strip()
            
            if emp_id.isdigit():
                year = int(year) if year.isdigit() else datetime.now().year
                try:
                    report = self.report_generator.employee_absence_report(int(emp_id), year)
                    print(f"\n{report.title}")
                    print(json.dumps(report.data, indent=2, default=str))
                except Exception as e:
                    print(f"Error: {e}")
    
    def _interactive_export(self):
        """Interactive data export."""
        print("\nAvailable tables to export:")
        for i, table in enumerate(sorted(self.engine.loaded_tables.keys()), 1):
            print(f"{i}. {table}")
        
        table_idx = input("Select table number: ").strip()
        if table_idx.isdigit():
            tables = sorted(self.engine.loaded_tables.keys())
            idx = int(table_idx) - 1
            if 0 <= idx < len(tables):
                table_name = tables[idx]
                
                format_choice = input("Format (csv/json/html/markdown): ").strip().lower()
                if format_choice in ["csv", "json", "html", "markdown"]:
                    # Get data
                    data = (self.engine.query()
                           .select(table_name)
                           .limit(100)
                           .execute()
                           .to_dict())
                    
                    # Export
                    filename = f"export_{table_name}.{format_choice}"
                    self.data_exporter.export(data, format_choice, Path(filename))
                    print(f"Exported to: {filename}")
    
    def _show_relationships(self):
        """Show relationship information."""
        graph = relationship_manager.get_relationship_graph()
        print("\nTable Relationships:")
        for source_table, relationships in sorted(graph.items()):
            print(f"\n{source_table}:")
            for target, info in relationships.items():
                print(f"  → {target} via {info['field']} ({info['type']})")
                if info['description']:
                    print(f"    {info['description']}")


def main():
    """Main entry point for the demo."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="OpenSchichtplaner5 Comprehensive Demo"
    )
    parser.add_argument(
        "--dir",
        required=True,
        type=Path,
        help="Directory containing DBF files"
    )
    parser.add_argument(
        "--interactive",
        action="store_true",
        help="Run in interactive mode"
    )
    
    args = parser.parse_args()
    
    # Check if directory exists
    if not args.dir.exists():
        print(f"Error: Directory {args.dir} does not exist")
        sys.exit(1)
    
    # Run demo
    demo = OpenSchichtplaner5Demo(args.dir)
    
    if args.interactive:
        demo.interactive_menu()
    else:
        demo.run_all_demos()


if __name__ == "__main__":
    main()
