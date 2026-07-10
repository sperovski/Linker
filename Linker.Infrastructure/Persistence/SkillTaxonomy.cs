namespace Linker.Infrastructure.Persistence;

/// <summary>
/// The canonical skill taxonomy seeded (upserted by name) on every startup.
/// To change the catalogue, edit this list only — the seeder inserts missing
/// names and re-categorises existing ones, and never deletes, so renames are
/// safe for rows students already reference.
/// </summary>
public static class SkillTaxonomy
{
    public static readonly IReadOnlyList<(string Category, string[] Names)> Categories =
    [
        ("Programming Languages", [
            "C#", "Java", "Python", "JavaScript", "TypeScript", "C", "C++", "Go",
            "Rust", "Kotlin", "Swift", "PHP", "Ruby", "SQL", "R", "MATLAB", "Scala", "Dart"
        ]),
        ("Frontend", [
            "Angular", "React", "Vue.js", "Svelte", "Next.js", "HTML", "CSS",
            "Sass/SCSS", "Tailwind CSS", "Bootstrap", "RxJS", "Redux", "WebSockets"
        ]),
        ("Backend", [
            ".NET / ASP.NET Core", "Spring Boot", "Node.js", "Express", "Django",
            "Flask", "FastAPI", "Laravel", "Ruby on Rails", "GraphQL", "REST APIs",
            "gRPC", "Microservices", "Entity Framework"
        ]),
        ("Mobile", [
            "Android", "iOS", "React Native", "Flutter", "SwiftUI", "Jetpack Compose"
        ]),
        ("Databases", [
            "PostgreSQL", "MySQL", "SQL Server", "MongoDB", "Redis", "SQLite",
            "Elasticsearch", "Oracle Database", "Database Design"
        ]),
        ("Cloud & DevOps", [
            "AWS", "Azure", "Google Cloud", "Docker", "Kubernetes", "Terraform",
            "CI/CD", "GitHub Actions", "Linux", "Bash/Shell Scripting", "Nginx",
            "Serverless", "Monitoring & Observability"
        ]),
        ("Data Science & ML", [
            "Machine Learning", "Deep Learning", "Data Analysis", "pandas", "NumPy",
            "scikit-learn", "TensorFlow", "PyTorch", "NLP", "Computer Vision",
            "Data Visualization", "Statistics", "Big Data", "Power BI", "Tableau"
        ]),
        ("Testing & QA", [
            "Unit Testing", "Integration Testing", "Test Automation", "Selenium",
            "Cypress", "Playwright", "JUnit", "xUnit/NUnit", "Manual Testing", "QA Processes"
        ]),
        ("Design", [
            "Figma", "Adobe Photoshop", "Adobe Illustrator", "Adobe XD", "Sketch",
            "UI Design", "UX Research", "Wireframing & Prototyping", "Design Systems",
            "Graphic Design", "Motion Design"
        ]),
        ("Dev Tools & Practices", [
            "Git", "GitHub/GitLab", "Agile/Scrum", "Jira", "Code Review",
            "Debugging", "Technical Documentation", "Visual Studio", "VS Code", "IntelliJ IDEA"
        ]),
        ("Security", [
            "Web Security", "Network Security", "Penetration Testing", "Cryptography",
            "OWASP", "Security Auditing", "Identity & Access Management"
        ]),
        ("CS Fundamentals", [
            "Data Structures", "Algorithms", "Object-Oriented Programming",
            "Functional Programming", "Operating Systems", "Computer Networks",
            "Distributed Systems", "Compilers", "Embedded Systems", "Game Development"
        ]),
        ("Soft Skills", [
            "Communication", "Teamwork", "Problem Solving", "Critical Thinking",
            "Time Management", "Leadership", "Presentation Skills", "Adaptability",
            "Creativity", "Attention to Detail", "Mentoring", "Public Speaking"
        ]),
        ("Business & Finance", [
            "Excel", "Accounting", "Financial Analysis", "Marketing", "Digital Marketing",
            "SEO", "Project Management", "Business Analysis", "Product Management",
            "Sales", "Customer Support", "Economics", "Entrepreneurship", "Copywriting"
        ]),
        ("Engineering (non-CS)", [
            "AutoCAD", "SolidWorks", "Revit", "CAD Modeling", "Mechanical Design",
            "Thermodynamics", "Structural Analysis", "Construction Management",
            "Architectural Design", "Urban Planning", "Electrical Circuits",
            "PLC Programming", "3D Printing", "GIS"
        ]),
        ("Sciences", [
            "Physics", "Chemistry", "Biology", "Mathematics", "Laboratory Techniques",
            "Research Methods", "Technical Writing", "Environmental Science"
        ]),
        ("Languages", [
            "English", "German", "French", "Spanish", "Italian", "Macedonian",
            "Albanian", "Serbian", "Bulgarian", "Greek", "Turkish", "Russian", "Chinese"
        ]),
    ];
}
