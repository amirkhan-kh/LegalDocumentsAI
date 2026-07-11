export type Section =
  | "dashboard"
  | "review"
  | "contracts"
  | "obligations"
  | "tasks"
  | "comparison"
  | "templates"
  | "knowledge"
  | "analytics"
  | "staff"
  | "analysis";

export type RiskLevel = "low" | "medium" | "high";
export type ContractStatus = "analyzed" | "review" | "draft";
export type ObligationStatus = "review" | "active" | "overdue" | "completed" | "archived";
export type TaskStatus = "pending" | "progress" | "done";
export type ProposalStatus = "draft" | "testing" | "approved" | "promoted" | "discarded";

export type Risk = {
  id: string;
  title: string;
  detail: string;
  severity: RiskLevel;
  source: string;
  confidence?: number;
  pageNumber?: number | null;
  recommendation?: string;
};

export type Obligation = {
  id: string;
  contractId: string;
  title: string;
  description: string;
  owner: string;
  dueDate: string;
  status: ObligationStatus;
  confidence: number;
  source: string;
  category: string;
  kept?: boolean;
};

export type ContractField = {
  label: string;
  value: string;
  confidence: number;
  source: string;
  pageNumber?: number | null;
  needsReview?: boolean;
};

export type Contract = {
  id: string;
  title: string;
  fileName: string;
  counterparty: string;
  type: string;
  language: "uz" | "ru" | "en" | "mixed" | "unknown";
  status: ContractStatus;
  riskLevel: RiskLevel;
  aiScore: number;
  uploadedAt: string;
  value: string;
  term: string;
  law: string;
  fields: ContractField[];
  risks: Risk[];
};

export type Task = {
  id: string;
  title: string;
  contractId: string;
  obligationId?: string;
  owner: string;
  dueDate: string;
  status: TaskStatus;
  priority: RiskLevel;
  audit: string[];
};

export type Template = {
  id: string;
  name: string;
  domain: string;
  status: "global" | "staging";
  fields: TemplateField[];
};

export type TemplateField = {
  id: string;
  label: string;
  key: string;
  type: "text" | "money" | "date" | "party" | "number" | "boolean";
  example: string;
};

export type Proposal = {
  id: string;
  kind: "domain" | "template";
  title: string;
  status: ProposalStatus;
  confidence: number;
  summary: string;
};

export type AnalysisRun = {
  id: string;
  stage: "uploaded" | "classifying" | "extracting" | "done";
  contract: Contract;
  obligations: Obligation[];
  reviewQueue?: ReviewQueueItem[];
  alerts?: AlertItem[];
  summary?: LegalSummary;
  processingMs?: number;
  modelUsed?: string;
};

export type ReviewQueueItem = {
  item_type: string;
  item_id: string;
  reason: string;
  priority: RiskLevel;
};

export type AlertItem = {
  title: string;
  trigger: string;
  recommended_owner_role: string;
  days_before: number;
  source: string;
};

export type LegalSummary = {
  short: string;
  what_to_check_first: string[];
  processing_notes: string[];
};

export type ApiLegalAnalysis = {
  id: string;
  model_used?: string;
  processing_ms: number;
  document: {
    title: string;
    file_name: string;
    language: Contract["language"];
    document_class: string;
    contract_type: string;
    sub_type: string;
    counterparty: string;
    effective_date: string;
    end_date: string;
    term: string;
    value: string;
    currency: string;
    governing_law: string;
    ai_score: number;
    risk_level: RiskLevel;
  };
  fields: Array<ContractField & { id: string; page_number?: number | null; needs_review?: boolean }>;
  risks: Array<Risk & { page_number?: number | null }>;
  obligations: Array<{
    id: string;
    title: string;
    description: string;
    owner_role: string;
    due_date: string;
    deadline_text: string;
    status: "review";
    importance: string;
    confidence: number;
    page_number?: number | null;
    source: string;
    category: string;
    recurrence: string;
    kept?: boolean;
  }>;
  review_queue: ReviewQueueItem[];
  alerts: AlertItem[];
  summary: LegalSummary;
};

export type ComparisonItem = {
  id: string;
  clause: string;
  reference: string;
  candidate: string;
  impact: string;
  severity: RiskLevel;
};

export type ReviewWorkspaceState = {
  selectedFile: File | null;
  run: AnalysisRun | null;
  progressStage: AnalysisRun["stage"] | null;
  isAnalyzing: boolean;
  error: string;
};

export type ComparisonWorkspaceState = {
  reference: string;
  candidate: string;
  items: ComparisonItem[];
};

export type TemplateWorkspaceState = {
  selectedId: string;
  fieldName: string;
  templateName: string;
  domain: string;
};

export type KnowledgeDocument = {
  id: string;
  title: string;
  kind: "system" | "client";
  domain: string;
  language: string;
  sourceFileName: string;
  uploadedAt: string | null;
  fileName?: string;
  tags?: string[];
  chunks: number;
};

export type KnowledgeStats = {
  corpusDir: string;
  uploadsDir?: string;
  chunks: number;
  files: string[];
  documents: number;
};

export type KnowledgeWorkspaceState = {
  documents: KnowledgeDocument[];
  stats: KnowledgeStats | null;
  isLoading: boolean;
  isUploading: boolean;
  error: string;
  title: string;
  domain: string;
  language: string;
  selectedFile: File | null;
};

export type SearchMatch = {
  id: string;
  section: Section;
  label: string;
  detail: string;
  contractId?: string;
};

export type LegalMetrics = {
  contracts: number;
  activeObligations: number;
  overdue: number;
  avgScore: number;
  highRisks: number;
};
