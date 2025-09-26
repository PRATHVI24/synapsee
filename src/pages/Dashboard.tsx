import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { Activity, DollarSign, Bot, Phone, TrendingUp, FileText, Users, Calendar } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface ProjectStats {
  name: string;
  icon: React.ElementType;
  color: string;
  description: string;
  stats: {
    total: number;
    active: number;
    completed: number;
    successRate: number;
  };
  recentActivity: string;
}

const Dashboard = () => {
  const [projectStats] = useState<ProjectStats[]>([
    {
      name: "HL7 Document Processor",
      icon: Activity,
      color: "medical",
      description: "Process medical documents and HL7 messages with multi-engine OCR",
      stats: { total: 156, active: 8, completed: 148, successRate: 94.8 },
      recentActivity: "Last processed: Patient_Data_2024.hl7"
    },
    {
      name: "Finance OCR",
      icon: DollarSign,
      color: "finance", 
      description: "Extract financial data from invoices, receipts, and statements",
      stats: { total: 89, active: 3, completed: 86, successRate: 96.6 },
      recentActivity: "Last processed: Q1_Invoice_Bundle.pdf"
    },
    {
      name: "AI Interview Bot",
      icon: Bot,
      color: "ai",
      description: "Automated interview management with real-time evaluation",
      stats: { total: 42, active: 5, completed: 37, successRate: 88.1 },
      recentActivity: "Upcoming: Senior Developer interview at 2:00 PM"
    },
    {
      name: "Outbound Sales Manager",
      icon: Phone,
      color: "sales",
      description: "AI-powered outbound sales calls for dental practice lead generation",
      stats: { total: 234, active: 12, completed: 222, successRate: 24.3 },
      recentActivity: "Campaign: Dental Practice Q1 - 8 meetings booked today"
    }
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard Overview</h1>
          <p className="text-muted-foreground mt-2">
            Monitor all your AI/ML automation projects from one central location
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Total Projects Active</p>
            <p className="text-2xl font-bold text-primary">4</p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Processed</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">521</div>
            <p className="text-xs text-muted-foreground">+12% from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">28</div>
            <p className="text-xs text-muted-foreground">Currently processing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">92.4%</div>
            <p className="text-xs text-success">+2.1% improvement</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Meetings Booked</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">23</div>
            <p className="text-xs text-muted-foreground">This week</p>
          </CardContent>
        </Card>
      </div>

      {/* Project Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {projectStats.map((project, index) => {
          const IconComponent = project.icon;
          
          return (
            <Card key={index} className="dashboard-card hover:scale-[1.02] transition-transform duration-200">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg gradient-${project.color} flex items-center justify-center`}>
                      <IconComponent className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-semibold">{project.name}</CardTitle>
                      <CardDescription className="text-sm">{project.description}</CardDescription>
                    </div>
                  </div>
                  
                  <Badge variant="outline" className={`project-${project.color}`}>
                    {project.stats.successRate}% Success
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-primary">{project.stats.total}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-warning">{project.stats.active}</p>
                    <p className="text-xs text-muted-foreground">Active</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-success">{project.stats.completed}</p>
                    <p className="text-xs text-muted-foreground">Completed</p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Completion Rate</span>
                    <span>{project.stats.successRate}%</span>
                  </div>
                  <Progress value={project.stats.successRate} className="h-2" />
                </div>

                {/* Recent Activity */}
                <div className="pt-2 border-t border-border">
                  <p className="text-sm text-muted-foreground mb-2">Recent Activity:</p>
                  <p className="text-sm font-medium">{project.recentActivity}</p>
                </div>

                {/* Action Button */}
                <NavLink
                  to={project.name === "HL7 Document Processor" ? "/hl7" : `/${project.name.toLowerCase().replace(/\s+/g, '-')}`}
                  className={`inline-flex items-center justify-center w-full h-9 px-4 py-2 bg-${project.color} text-${project.color}-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity`}
                >
                  Open {project.name}
                </NavLink>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default Dashboard;