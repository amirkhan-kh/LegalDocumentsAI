import type { Section } from "./types";
import type { LegalWorkspaceModel } from "./state/useLegalWorkspace";
import {
  AnalyticsWorkspace,
  ComparisonWorkspace,
  ContractsWorkspace,
  Dashboard,
  DeepAnalysis,
  KnowledgeBaseWorkspace,
  ObligationsWorkspace,
  ReviewWorkspace,
  StaffWorkspace,
  TasksWorkspace,
  TemplatesWorkspace,
} from "./pages/LegalWorkspacePages";

type LegalWorkspaceRouterProps = {
  active: Section;
  workspace: LegalWorkspaceModel;
  onNavigate: (section: Section) => void;
};

export function LegalWorkspaceRouter({ active, workspace, onNavigate }: LegalWorkspaceRouterProps) {
  switch (active) {
    case "dashboard":
      return (
        <Dashboard
          metrics={workspace.metrics}
          contracts={workspace.contracts}
          obligations={workspace.obligations}
          tasks={workspace.tasks}
          onOpenContract={workspace.openContract}
        />
      );
    case "review":
      return (
        <ReviewWorkspace
          state={workspace.reviewState}
          setState={workspace.setReviewState}
          onSave={workspace.saveAnalysis}
          recentContracts={workspace.contracts.slice(0, 4)}
        />
      );
    case "contracts":
      return (
        <ContractsWorkspace
          contracts={workspace.contracts}
          obligations={workspace.obligations}
          selected={workspace.selectedContract}
          query={workspace.contractQuery}
          onQueryChange={workspace.setContractQuery}
          onSelect={workspace.setSelectedContractId}
          onReextract={() => onNavigate("review")}
        />
      );
    case "obligations":
      return (
        <ObligationsWorkspace
          obligations={workspace.obligations}
          contracts={workspace.contracts}
          filter={workspace.obligationFilter}
          onFilterChange={workspace.setObligationFilter}
          onUpdate={workspace.updateObligation}
          onCreateTask={workspace.addTaskFromObligation}
        />
      );
    case "tasks":
      return (
        <TasksWorkspace
          tasks={workspace.tasks}
          contracts={workspace.contracts}
          onUpdate={workspace.updateTask}
        />
      );
    case "comparison":
      return <ComparisonWorkspace state={workspace.comparisonState} setState={workspace.setComparisonState} />;
    case "templates":
      return (
        <TemplatesWorkspace
          templates={workspace.templates}
          setTemplates={workspace.setTemplates}
          state={workspace.templateState}
          setState={workspace.setTemplateState}
        />
      );
    case "knowledge":
      return (
        <KnowledgeBaseWorkspace
          state={workspace.knowledgeState}
          setState={workspace.setKnowledgeState}
          onRefresh={workspace.refreshKnowledgeBase}
          onUpload={workspace.uploadKnowledge}
          onDelete={workspace.removeKnowledgeDocument}
        />
      );
    case "analytics":
      return <AnalyticsWorkspace contracts={workspace.contracts} obligations={workspace.obligations} tasks={workspace.tasks} />;
    case "staff":
      return (
        <StaffWorkspace
          proposals={workspace.proposals}
          onAddProposal={workspace.addStaffProposal}
          onUpdate={workspace.updateProposalStatus}
        />
      );
    case "analysis":
      return <DeepAnalysis />;
  }
}
