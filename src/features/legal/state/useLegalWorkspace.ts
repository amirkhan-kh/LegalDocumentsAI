import { useEffect, useMemo, useState } from "react";
import { deleteKnowledgeDocument, fetchKnowledgeBase, uploadKnowledgeDocument } from "../api";
import { buildSearchMatches, daysUntil, makeId } from "../domain";
import type {
  AnalysisRun,
  ComparisonWorkspaceState,
  Contract,
  KnowledgeWorkspaceState,
  LegalMetrics,
  Obligation,
  ObligationStatus,
  Proposal,
  ProposalStatus,
  ReviewWorkspaceState,
  RiskLevel,
  SearchMatch,
  Section,
  Task,
  TaskStatus,
  Template,
  TemplateWorkspaceState,
} from "../types";

type UseLegalWorkspaceOptions = {
  navigateTo: (section: Section) => void;
};

export function useLegalWorkspace({ navigateTo }: UseLegalWorkspaceOptions) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [selectedContractId, setSelectedContractId] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const [contractQuery, setContractQuery] = useState("");
  const [obligationFilter, setObligationFilter] = useState<ObligationStatus | "all">("all");
  const [reviewState, setReviewState] = useState<ReviewWorkspaceState>({
    selectedFile: null,
    run: null,
    progressStage: null,
    analysisJobId: null,
    analysisProgress: 0,
    analysisMessage: "",
    analysisChunks: { completed: 0, total: null },
    isAnalyzing: false,
    error: "",
  });
  const [comparisonState, setComparisonState] = useState<ComparisonWorkspaceState>({
    reference: "",
    candidate: "",
    items: [],
  });
  const [templateState, setTemplateState] = useState<TemplateWorkspaceState>({
    selectedId: "",
    fieldName: "",
    templateName: "",
    domain: "Commercial",
  });
  const [knowledgeState, setKnowledgeState] = useState<KnowledgeWorkspaceState>({
    documents: [],
    stats: null,
    isLoading: false,
    isUploading: false,
    error: "",
    title: "",
    domain: "Legal",
    language: "mixed",
    selectedFile: null,
  });

  const selectedContract = contracts.find((contract) => contract.id === selectedContractId) ?? contracts[0] ?? null;
  const metrics = useMemo<LegalMetrics>(() => {
    const activeObligations = obligations.filter((obligation) => obligation.status === "active" || obligation.status === "overdue");
    const avgScore = Math.round(contracts.reduce((sum, contract) => sum + contract.aiScore, 0) / Math.max(contracts.length, 1));
    return {
      contracts: contracts.length,
      activeObligations: activeObligations.length,
      overdue: obligations.filter((obligation) => obligation.status === "overdue").length,
      avgScore,
      highRisks: contracts.reduce((sum, contract) => sum + contract.risks.filter((risk) => risk.severity === "high").length, 0),
    };
  }, [contracts, obligations]);
  const globalMatches = useMemo(() => buildSearchMatches(globalSearch, contracts, obligations, tasks), [globalSearch, contracts, obligations, tasks]);
  const aiQueueCount = metrics.highRisks + obligations.filter((item) => item.status === "review").length;

  useEffect(() => {
    void refreshKnowledgeBase();
  }, []);

  const openContract = (id: string) => {
    setSelectedContractId(id);
    navigateTo("contracts");
  };

  const saveAnalysis = (run: AnalysisRun) => {
    const kept = run.obligations
      .filter((obligation) => obligation.kept !== false)
      .map((obligation) => ({ ...obligation, status: "active" as ObligationStatus, kept: undefined }));

    setContracts((current) => [{ ...run.contract, status: "analyzed" }, ...current]);
    setObligations((current) => [...kept, ...current]);
    setTasks((current) => [
      ...buildObligationTasks(kept),
      ...buildRiskTasks(run),
      ...current,
    ]);

    if (run.contract.fields.length) {
      const template = buildTemplateFromAnalysis(run);
      setTemplates((current) => [template, ...current]);
      setTemplateState((current) => ({ ...current, selectedId: template.id }));
    }

    setProposals((current) => [{
      id: makeId("PRP"),
      kind: "domain",
      title: `${run.contract.type} uchun review guardrail`,
      status: "testing",
      confidence: run.contract.aiScore,
      summary: `${run.contract.risks.length} risk, ${kept.length} majburiyat va ${run.reviewQueue?.length ?? 0} review queue elementi asosida staff taklifi yaratildi.`,
    }, ...current]);
    setSelectedContractId(run.contract.id);
    navigateTo("contracts");
  };

  const updateObligation = (id: string, patch: Partial<Obligation>) => {
    setObligations((current) => current.map((obligation) => obligation.id === id ? { ...obligation, ...patch } : obligation));
  };

  const addTaskFromObligation = (obligation: Obligation) => {
    setTasks((current) => [{
      id: makeId("TSK"),
      title: `${obligation.title} ijrosi`,
      contractId: obligation.contractId,
      obligationId: obligation.id,
      owner: obligation.owner,
      dueDate: obligation.dueDate,
      status: "pending",
      priority: obligation.status === "overdue" ? "high" : "medium",
      audit: ["Majburiyatdan qo'lda yaratildi"],
    }, ...current]);
    navigateTo("tasks");
  };

  const updateTask = (id: string, patch: Partial<Task>) => {
    setTasks((current) => current.map((task) => task.id === id ? { ...task, ...patch, audit: [...task.audit, "Holat yangilandi"] } : task));
  };

  const addStaffProposal = (files: FileList | null) => {
    if (!files?.length) return;
    const next = Array.from(files)
      .filter((file) => file.type === "application/pdf" || /\.pdf$/i.test(file.name))
      .map((file) => ({
        id: makeId("PRP"),
        kind: "template" as const,
        title: `${file.name.replace(/\.pdf$/i, "")} uchun extraction taklifi`,
        status: "draft" as ProposalStatus,
        confidence: 78,
        summary: "Reference PDF asosida domen, maydonlar va review guardrail taklifi stagingga qo'shildi.",
      }));
    if (next.length) setProposals((current) => [...next, ...current]);
  };

  const updateProposalStatus = (id: string, status: ProposalStatus) => {
    setProposals((current) => current.map((proposal) => proposal.id === id ? { ...proposal, status } : proposal));
  };

  const openSearchMatch = (match: SearchMatch) => {
    if (match.contractId) setSelectedContractId(match.contractId);
    navigateTo(match.section);
    setGlobalSearch("");
  };

  const refreshKnowledgeBase = async () => {
    setKnowledgeState((current) => ({ ...current, isLoading: true, error: "" }));
    try {
      const response = await fetchKnowledgeBase();
      setKnowledgeState((current) => ({
        ...current,
        documents: response.documents,
        stats: response.stats,
        isLoading: false,
      }));
    } catch (error) {
      setKnowledgeState((current) => ({
        ...current,
        isLoading: false,
        error: error instanceof Error ? error.message : "Bilim bazasini olishda xatolik yuz berdi.",
      }));
    }
  };

  const uploadKnowledge = async () => {
    if (!knowledgeState.selectedFile) {
      setKnowledgeState((current) => ({ ...current, error: "Qo'llanma faylini tanlang." }));
      return;
    }
    setKnowledgeState((current) => ({ ...current, isUploading: true, error: "" }));
    try {
      const response = await uploadKnowledgeDocument(knowledgeState.selectedFile, {
        title: knowledgeState.title,
        domain: knowledgeState.domain,
        language: knowledgeState.language,
      });
      setKnowledgeState((current) => ({
        ...current,
        documents: response.documents,
        stats: response.stats,
        selectedFile: null,
        title: "",
        isUploading: false,
      }));
    } catch (error) {
      setKnowledgeState((current) => ({
        ...current,
        isUploading: false,
        error: error instanceof Error ? error.message : "Qo'llanmani yuklashda xatolik yuz berdi.",
      }));
    }
  };

  const removeKnowledgeDocument = async (id: string) => {
    setKnowledgeState((current) => ({ ...current, error: "" }));
    try {
      const response = await deleteKnowledgeDocument(id);
      setKnowledgeState((current) => ({
        ...current,
        documents: response.documents,
        stats: response.stats,
      }));
    } catch (error) {
      setKnowledgeState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : "Bilim bazasi hujjatini o'chirishda xatolik yuz berdi.",
      }));
    }
  };

  return {
    contracts,
    obligations,
    tasks,
    templates,
    proposals,
    selectedContract,
    selectedContractId,
    contractQuery,
    obligationFilter,
    reviewState,
    comparisonState,
    templateState,
    knowledgeState,
    metrics,
    aiQueueCount,
    globalSearch,
    globalMatches,
    setGlobalSearch,
    setSelectedContractId,
    setContractQuery,
    setObligationFilter,
    setReviewState,
    setComparisonState,
    setTemplates,
    setTemplateState,
    setKnowledgeState,
    saveAnalysis,
    updateObligation,
    addTaskFromObligation,
    updateTask,
    addStaffProposal,
    updateProposalStatus,
    openContract,
    openSearchMatch,
    refreshKnowledgeBase,
    uploadKnowledge,
    removeKnowledgeDocument,
  };
}

export type LegalWorkspaceModel = ReturnType<typeof useLegalWorkspace>;

function buildObligationTasks(obligations: Obligation[]): Task[] {
  return obligations.map((obligation) => ({
    id: makeId("TSK"),
    title: `${obligation.title} ijrosi`,
    contractId: obligation.contractId,
    obligationId: obligation.id,
    owner: obligation.owner,
    dueDate: obligation.dueDate,
    status: "pending" as TaskStatus,
    priority: daysUntil(obligation.dueDate) < 0 ? "high" as RiskLevel : daysUntil(obligation.dueDate) <= 60 ? "medium" as RiskLevel : "low" as RiskLevel,
    audit: ["AI tahlildan majburiyat vazifasi yaratildi", `${obligation.owner} ga biriktirildi`],
  }));
}

function buildRiskTasks(run: AnalysisRun): Task[] {
  return run.contract.risks
    .filter((risk) => risk.severity === "high" || risk.severity === "medium")
    .map((risk) => ({
      id: makeId("TSK"),
      title: `${risk.title} riskini ko'rib chiqish`,
      contractId: run.contract.id,
      owner: "Aziza R.",
      dueDate: "2026-07-20",
      status: "pending" as TaskStatus,
      priority: risk.severity,
      audit: ["AI risk findingdan yaratildi", risk.source],
    }));
}

function buildTemplateFromAnalysis(run: AnalysisRun): Template {
  return {
    id: makeId("TPL"),
    name: `${run.contract.type || "Shartnoma"} extraction template`,
    domain: run.contract.type || "Contract",
    status: "staging",
    fields: run.contract.fields.slice(0, 10).map((field) => ({
      id: makeId("F"),
      label: field.label,
      key: field.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || makeId("field").toLowerCase(),
      type: /date|sana|muddat/i.test(field.label) ? "date" : /value|qiymat|amount|price|sum/i.test(field.label) ? "money" : "text",
      example: field.value || "Namuna qiymat",
    })),
  };
}
