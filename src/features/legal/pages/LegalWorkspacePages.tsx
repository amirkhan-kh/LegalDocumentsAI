import {
  Activity,
  Archive,
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  Brain,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Database,
  Download,
  Eye,
  FileDiff,
  FileSearch,
  FileText,
  FileUp,
  FlaskConical,
  FolderKanban,
  GitCompareArrows,
  Library,
  ListChecks,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  Sparkles,
  SquarePen,
  Trash2,
  TriangleAlert,
  Upload,
  Users,
} from "lucide-react";
import type * as React from "react";
import { Badge, Bar, EmptyState, KeyValue, MetricCard, PageIntro, Panel } from "../../../components/ui";
import { analyzeLegalPdf, requestErrorMessage } from "../api";
import { daysUntil, employees, fmtDate, makeId, riskLabel, statusLabel } from "../domain";
import type {
  AnalysisRun,
  ComparisonItem,
  ComparisonWorkspaceState,
  Contract,
  KnowledgeWorkspaceState,
  Obligation,
  ObligationStatus,
  Proposal,
  ProposalStatus,
  ReviewWorkspaceState,
  RiskLevel,
  Task,
  TaskStatus,
  Template,
  TemplateWorkspaceState,
} from "../types";

export function Dashboard({ metrics, contracts, obligations, tasks, onOpenContract }: {
  metrics: { contracts: number; activeObligations: number; overdue: number; avgScore: number; highRisks: number };
  contracts: Contract[];
  obligations: Obligation[];
  tasks: Task[];
  onOpenContract: (id: string) => void;
}) {
  const upcoming = [...obligations].filter((item) => item.status !== "archived" && item.status !== "completed").sort((a, b) => daysUntil(a.dueDate) - daysUntil(b.dueDate)).slice(0, 5);
  const flagged = contracts.flatMap((contract) => contract.risks.map((risk) => ({ contract, risk }))).sort((a, b) => (b.risk.severity === "high" ? 1 : 0) - (a.risk.severity === "high" ? 1 : 0)).slice(0, 4);
  const counterparties = Array.from(new Set(contracts.map((contract) => contract.counterparty).filter(Boolean))).slice(0, 5);
  return (
    <section className="section-grid">
      <PageIntro
        icon={BarChart3}
        title="Portfel holati"
        subtitle="Shartnomalar, deadline, risk va vazifalar bitta ish panelida jamlanadi."
        items={[
          { label: "Shartnomalar", value: metrics.contracts, tone: "info" },
          { label: "Faol majburiyat", value: metrics.activeObligations, tone: "success" },
          { label: "Kechikkan", value: metrics.overdue, tone: metrics.overdue ? "danger" : "neutral" },
          { label: "AI ball", value: `${metrics.avgScore}%`, tone: "success" },
        ]}
      />
      <div className="kpi-row">
        <MetricCard icon={FileText} label="Shartnomalar" value={metrics.contracts} detail="3 tilda hujjatlar" />
        <MetricCard icon={ListChecks} label="Faol majburiyatlar" value={metrics.activeObligations} detail="owner va deadline bilan" />
        <MetricCard icon={TriangleAlert} label="Kechikkan" value={metrics.overdue} detail="tezkor e'tibor talab qiladi" tone="danger" />
        <MetricCard icon={Brain} label="AI o'rtacha ball" value={`${metrics.avgScore}%`} detail={`${metrics.highRisks} yuqori risk`} tone="success" />
      </div>
      <div className="split-layout">
        <Panel title="Deadline va AI prioritet" subtitle="Kechikkan va yaqin sanalar birinchi ko'rinadi" icon={CalendarClock}>
          <div className="stack-list">
            {upcoming.length ? upcoming.map((item) => (
              <button className="row-button" key={item.id} onClick={() => onOpenContract(item.contractId)}>
                <span className={`status-dot ${item.status}`} />
                <span className="row-main">
                  <strong>{item.title}</strong>
                  <small>{item.owner} · {fmtDate(item.dueDate)} · {daysUntil(item.dueDate)} kun</small>
                </span>
                <Badge tone={item.status === "overdue" ? "danger" : "info"}>{statusLabel(item.status)}</Badge>
              </button>
            )) : <EmptyState icon={CalendarClock} title="Deadline yo'q" text="PDF tahlilidan keyin majburiyat va sanalar shu yerda chiqadi." />}
          </div>
        </Panel>
        <Panel title="AI risklar" subtitle="Portfeldagi eng muhim topilmalar" icon={TriangleAlert}>
          <div className="risk-list">
            {flagged.length ? flagged.map(({ contract, risk }) => (
              <button className="risk-item" key={risk.id} onClick={() => onOpenContract(contract.id)}>
                <div>
                  <Badge tone={risk.severity === "high" ? "danger" : "warning"}>{riskLabel(risk.severity)}</Badge>
                  <h3>{risk.title}</h3>
                  <p>{contract.counterparty} · {risk.source}</p>
                </div>
                <ChevronRight size={18} />
              </button>
            )) : <EmptyState icon={TriangleAlert} title="Risk yo'q" text="Vertex AI topgan xavf bandlari hujjat tahlilidan keyin ko'rinadi." />}
          </div>
        </Panel>
      </div>
      <div className="split-layout three">
        <Panel title="Mening ishlarim" subtitle="Ochiq vazifalar va holat" icon={FolderKanban}>
          <div className="compact-list">
            {tasks.filter((task) => task.status !== "done").length ? tasks.filter((task) => task.status !== "done").slice(0, 5).map((task) => (
              <div className="compact-row" key={task.id}>
                <CheckCircle2 size={16} />
                <span>{task.title}</span>
                <Badge tone={task.priority === "high" ? "danger" : "neutral"}>{task.owner}</Badge>
              </div>
            )) : <EmptyState icon={FolderKanban} title="Vazifa yo'q" text="Past confidence yoki riskli majburiyatlardan vazifalar yaratiladi." />}
          </div>
        </Panel>
        <Panel title="Hujjat ishlash pipeline" subtitle="Kotib uslubidagi prinsip" icon={Bot}>
          <div className="pipeline">
            {["Yuklash", "Tasnif", "Ajratish", "Ko'rik", "Xabar"].map((item, index) => (
              <div className="pipeline-step" key={item}>
                <span>{index + 1}</span>
                <strong>{item}</strong>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Kontragentlar" subtitle="Faol portfel signali" icon={Building2}>
          <div className="counterparty-strip">
            {counterparties.length ? counterparties.map((item) => (
              <div key={item}>
                <Building2 size={16} />
                <span>{item}</span>
              </div>
            )) : <EmptyState icon={Building2} title="Kontragent yo'q" text="PDFdan aniqlangan tomonlar shu yerda ro'yxatlanadi." />}
          </div>
        </Panel>
      </div>
    </section>
  );
}

export function ReviewWorkspace({ state, setState, onSave, recentContracts }: {
  state: ReviewWorkspaceState;
  setState: React.Dispatch<React.SetStateAction<ReviewWorkspaceState>>;
  onSave: (run: AnalysisRun) => void;
  recentContracts: Contract[];
}) {
  const { selectedFile, run, progressStage, isAnalyzing, error } = state;
  const selectedFileIsPdf = !selectedFile || selectedFile.type === "application/pdf" || /\.pdf$/i.test(selectedFile.name);
  const patchState = (patch: Partial<ReviewWorkspaceState>) => setState((current) => ({ ...current, ...patch }));

  const startRun = async () => {
    if (!selectedFile) {
      patchState({ error: "PDF fayl tanlang." });
      return;
    }
    if (selectedFile.type !== "application/pdf" && !/\.pdf$/i.test(selectedFile.name)) {
      patchState({ error: "Faqat PDF qabul qilinadi. DOC/DOCX yoki matn maydoni ishlatilmaydi." });
      return;
    }
    patchState({ error: "", run: null, isAnalyzing: true, progressStage: "uploaded" });
    const timers = [
      window.setTimeout(() => patchState({ progressStage: "classifying" }), 800),
      window.setTimeout(() => patchState({ progressStage: "extracting" }), 2200),
    ];
    try {
      const analysisRun = await analyzeLegalPdf(selectedFile);
      patchState({ run: analysisRun, progressStage: "done" });
    } catch (requestError) {
      patchState({ error: requestErrorMessage(requestError), progressStage: null });
    } finally {
      timers.forEach(window.clearTimeout);
      patchState({ isAnalyzing: false });
    }
  };

  const updateRunObligation = (id: string, patch: Partial<Obligation>) => {
    setState((current) => ({
      ...current,
      run: current.run ? { ...current.run, obligations: current.run.obligations.map((item) => item.id === id ? { ...item, ...patch } : item) } : current.run,
    }));
  };

  return (
    <section className="workspace-grid review-grid">
      <div className="wide">
        <PageIntro
          icon={FileUp}
          title="PDF tahlil oqimi"
          subtitle="PDF yuklanadi, Vertex AI maydon/risk/majburiyatlarni ajratadi, keyin natija reyestrga saqlanadi."
          items={[
            { label: "Format", value: "PDF", tone: "info" },
            { label: "Tilllar", value: "UZ/RU/EN", tone: "success" },
            { label: "Holat", value: run ? "Tayyor" : isAnalyzing ? "Jarayonda" : "Kutilmoqda", tone: run ? "success" : isAnalyzing ? "warning" : "neutral" },
            { label: "Review", value: run?.reviewQueue?.length ?? 0, tone: run?.reviewQueue?.length ? "warning" : "neutral" },
          ]}
        />
      </div>
      <Panel title="PDF yuklash" subtitle="Faqat PDF qabul qilinadi: text PDF, scanned PDF, Uzbek/Russian/English" icon={FileUp}>
        <div className="form-grid">
          <label className="wide">
            PDF fayl
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) {
                  patchState({ selectedFile: null });
                  return;
                }
                patchState({
                  selectedFile: file,
                  run: null,
                  error: file.type === "application/pdf" || /\.pdf$/i.test(file.name) ? "" : "Faqat PDF qabul qilinadi.",
                });
              }}
            />
          </label>
          <div className="wide upload-rules">
            <div><CheckCircle2 size={16} /> PDF-only, 50MB gacha</div>
            <div><CheckCircle2 size={16} /> Skan PDF ham Vertex document understanding orqali o'qiladi</div>
            <div><CheckCircle2 size={16} /> O'zbek lotin/kiril, rus va ingliz tillari qo'llanadi</div>
            <div><CheckCircle2 size={16} /> Maydon, risk, majburiyat, page citation va confidence qaytadi</div>
          </div>
          {selectedFile && (
            <div className="wide selected-file">
              <FileText size={18} />
              <span>{selectedFile.name}</span>
              <Badge tone="info">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</Badge>
            </div>
          )}
          {error && <div className="wide error-box">{error}</div>}
          <button className="primary-button wide" disabled={isAnalyzing || !selectedFile || !selectedFileIsPdf} onClick={startRun}>
            <Sparkles size={17} /> {isAnalyzing ? "Vertex AI tahlil qilmoqda..." : "PDF tahlilni boshlash"}
          </button>
        </div>
      </Panel>
      <Panel title="Tahlil natijasi" subtitle="Klassifikatsiya, maydonlar, risklar va majburiyatlar" icon={Brain}>
        {!run ? (
          error ? (
            <div className="analysis-result">
              <div className="error-box">{error}</div>
              <EmptyState icon={TriangleAlert} title="Tahlil boshlanmadi" text="Server/model sozlamasi yoki PDF formatini tekshiring. Muammo tuzatilgandan keyin qayta boshlang." />
            </div>
          ) :
          progressStage ? (
            <div className="analysis-result">
              <div className="stage-row">
                {["uploaded", "classifying", "extracting", "done"].map((stage, index) => (
                  <div key={stage} className={`stage ${stageIndex(progressStage) >= index ? "complete" : ""}`}>
                    <span>{index + 1}</span>
                    <strong>{["PDF yuklandi", "Til/type aniqlash", "Maydon/risk chiqarish", "Tayyor"][index]}</strong>
                  </div>
                ))}
              </div>
              <EmptyState icon={Brain} title="Vertex AI PDFni o'qiyapti" text="Skan yoki ko'p sahifali hujjatlarda bu 40 soniya yoki undan ko'proq vaqt olishi mumkin." />
            </div>
          ) : (
            <EmptyState icon={Upload} title="PDF tanlanmagan" text="PDF yuklang. Tahlil natijasida kontragent, moliyaviy shartlar, muddatlar, risklar va majburiyatlar chiqadi." />
          )
        ) : (
          <div className="analysis-result">
            <div className="stage-row">
              {["uploaded", "classifying", "extracting", "done"].map((stage, index) => (
                <div key={stage} className={`stage ${stageIndex(run.stage) >= index ? "complete" : ""}`}>
                  <span>{index + 1}</span>
                  <strong>{["Yuklandi", "Tasnif", "Ajratish", "Tayyor"][index]}</strong>
                </div>
              ))}
            </div>
            <div className="result-head">
              <div>
                <h2>{run.contract.title}</h2>
                <p>{run.contract.type} · {run.contract.counterparty}</p>
                <p className="result-meta">{run.modelUsed || "Vertex AI"} · {run.processingMs ? `${Math.round(run.processingMs / 1000)}s` : "processing complete"} · {run.contract.language.toUpperCase()}</p>
              </div>
              <Badge tone={run.contract.riskLevel === "high" ? "danger" : run.contract.riskLevel === "medium" ? "warning" : "success"}>{riskLabel(run.contract.riskLevel)} risk</Badge>
            </div>
            <div className="field-grid">
              {run.contract.fields.map((field) => (
                <div className="field-chip" key={field.label}>
                  <span>{field.label}</span>
                  <strong>{field.value}</strong>
                      <small>{field.source} · {field.confidence}%{field.needsReview ? " · review" : ""}</small>
                    </div>
                  ))}
            </div>
            {run.summary && (
              <div className="summary-box">
                <strong>AI xulosa</strong>
                <p>{run.summary.short || "Xulosa mavjud emas."}</p>
                {run.summary.what_to_check_first.length > 0 && (
                  <ul>
                    {run.summary.what_to_check_first.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                )}
              </div>
            )}
            {run.contract.risks.length > 0 && (
              <div className="risk-list">
                {run.contract.risks.map((risk) => (
                  <div className="risk-item" key={risk.id}>
                    <div>
                      <Badge tone={risk.severity === "high" ? "danger" : risk.severity === "medium" ? "warning" : "success"}>{riskLabel(risk.severity)}</Badge>
                      <h3>{risk.title}</h3>
                      <p>{risk.detail}</p>
                      <small>{risk.source} · {risk.confidence ?? 0}%</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="obligation-review">
              <h3>Majburiyatlar review</h3>
              {run.obligations.map((item) => (
                <div className="obligation-card" key={item.id}>
                  <label className="checkline">
                    <input type="checkbox" checked={item.kept !== false} onChange={(event) => updateRunObligation(item.id, { kept: event.target.checked })} />
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.source} · {item.confidence}%</small>
                    </span>
                  </label>
                  <select value={item.owner} onChange={(event) => updateRunObligation(item.id, { owner: event.target.value })}>
                    {employees.map((employee) => <option key={employee}>{employee}</option>)}
                  </select>
                </div>
              ))}
            </div>
            {run.alerts && run.alerts.length > 0 && (
              <div className="alert-list">
                <h3>Kuzatuv va xabarnoma qoidalari</h3>
                {run.alerts.map((alert) => (
                  <div className="alert-card" key={`${alert.title}-${alert.source}`}>
                    <Bell size={16} />
                    <span>
                      <strong>{alert.title}</strong>
                      <small>{alert.trigger} · {alert.recommended_owner_role} · {alert.days_before} kun oldin · {alert.source}</small>
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="button-row">
              <button className="secondary-button" disabled={isAnalyzing || !selectedFile} onClick={startRun}><RefreshCw size={16} /> PDFni qayta tahlil</button>
              <button className="primary-button" disabled={run.stage !== "done"} onClick={() => onSave(run)}><Save size={16} /> Reyestrga saqlash</button>
            </div>
          </div>
        )}
      </Panel>
      <Panel title="Review navbati" subtitle="Oxirgi tahlil qilingan hujjatlar" icon={ClipboardList}>
        <div className="stack-list">
          {recentContracts.length ? recentContracts.map((contract) => (
            <div className="row-static" key={contract.id}>
              <FileText size={17} />
              <span className="row-main">
                <strong>{contract.title}</strong>
                <small>{contract.type} · {contract.aiScore}% confidence</small>
              </span>
              <Badge tone={contract.status === "review" ? "warning" : "success"}>{statusLabel(contract.status)}</Badge>
            </div>
          )) : <EmptyState icon={ClipboardList} title="Review navbati bo'sh" text="PDF tahlil qilingandan keyin hujjatlar shu yerda ko'rinadi." />}
        </div>
      </Panel>
    </section>
  );
}

export function ContractsWorkspace({ contracts, obligations, selected, query, onQueryChange, onSelect, onReextract }: {
  contracts: Contract[];
  obligations: Obligation[];
  selected: Contract | null;
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (id: string) => void;
  onReextract: (contract: Contract) => void;
}) {
  const filtered = contracts.filter((contract) => `${contract.title} ${contract.counterparty} ${contract.type}`.toLowerCase().includes(query.toLowerCase()));
  const selectedObligations = selected ? obligations.filter((item) => item.contractId === selected.id && item.status !== "archived") : [];
  return (
    <section className="workspace-grid contracts-grid">
      <div className="wide">
        <PageIntro
          icon={FileText}
          title="Shartnoma reyestri"
          subtitle="Saqlangan hujjatlar, AI ajratgan maydonlar va bog'langan majburiyatlar shu yerda boshqariladi."
          items={[
            { label: "Hujjatlar", value: contracts.length, tone: "info" },
            { label: "Qidiruv natija", value: filtered.length, tone: "neutral" },
            { label: "Tanlangan", value: selected ? "Bor" : "Yo'q", tone: selected ? "success" : "neutral" },
            { label: "Majburiyat", value: selectedObligations.length, tone: selectedObligations.length ? "warning" : "neutral" },
          ]}
        />
      </div>
      <Panel title="Shartnoma reyestri" subtitle="Ichki va AI tahlil qilingan hujjatlar" icon={FileText}>
        <label className="inline-search">
          <Search size={16} />
          <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Qidirish" aria-label="Shartnomalar ichidan qidirish" />
        </label>
        <div className="contract-list">
          {filtered.length ? filtered.map((contract) => (
            <button type="button" key={contract.id} className={selected?.id === contract.id ? "contract-row selected" : "contract-row"} onClick={() => onSelect(contract.id)}>
              <div>
                <strong>{contract.title}</strong>
                <small>{contract.counterparty}</small>
              </div>
              <Badge tone={contract.riskLevel === "high" ? "danger" : contract.riskLevel === "medium" ? "warning" : "success"}>{contract.aiScore}%</Badge>
            </button>
          )) : <EmptyState icon={FileText} title="Shartnoma yo'q" text="PDF tahlil qilib saqlangandan keyin reyestr shu yerda ko'rinadi." />}
        </div>
      </Panel>
      <Panel title={selected?.title ?? "Shartnoma tanlanmagan"} subtitle={selected ? `${selected.id} · ${selected.fileName}` : "PDF tahlil natijasini saqlang"} icon={Eye}>
        {selected ? (
          <>
            <div className="detail-toolbar">
              <Badge tone={selected.status === "review" ? "warning" : "success"}>{statusLabel(selected.status)}</Badge>
              <Badge tone="neutral">{selected.language.toUpperCase()}</Badge>
              <button type="button" className="secondary-button" onClick={() => onReextract(selected)}><RefreshCw size={16} /> Qayta tahlil qilish</button>
              <button type="button" className="secondary-button"><Download size={16} /> Natijani eksport</button>
            </div>
            <div className="detail-grid">
              <KeyValue label="Kontragent" value={selected.counterparty} />
              <KeyValue label="Hujjat turi" value={selected.type} />
              <KeyValue label="Qiymat" value={selected.value} />
              <KeyValue label="Muddat" value={selected.term} />
              <KeyValue label="Huquq" value={selected.law} />
              <KeyValue label="AI score" value={`${selected.aiScore}%`} />
            </div>
            <div className="source-layout">
              <div className="document-preview">
                <div className="paper">
                  <h3>{selected.title}</h3>
                  <p>Kontragent: {selected.counterparty}</p>
                  <p className="highlight">Vertex AI ajratgan maydonlar manba sahifa va confidence bilan bog'langan.</p>
                  <p>Qiymat: {selected.value}</p>
                  <p>Qo'llaniladigan huquq: {selected.law}</p>
                </div>
              </div>
              <div className="side-stack">
                <h3>Ajratilgan maydonlar</h3>
                {selected.fields.map((field) => (
                  <div className="field-chip" key={field.label}>
                    <span>{field.label}</span>
                    <strong>{field.value}</strong>
                    <small>{field.source} · {field.confidence}%{field.needsReview ? " · review" : ""}</small>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : <EmptyState icon={FileSearch} title="Hali tahlil yo'q" text="AI tahlil bo'limida PDF yuklang va natijani reyestrga saqlang." />}
      </Panel>
      <Panel title="Bog'langan majburiyatlar" subtitle="Saqlangan AI extraction natijalari" icon={ListChecks}>
        <div className="compact-list">
          {selectedObligations.length ? selectedObligations.map((item) => (
            <div className="compact-row tall" key={item.id}>
              <span className={`status-dot ${item.status}`} />
              <span>
                <strong>{item.title}</strong>
                <small>{item.owner} · {fmtDate(item.dueDate)} · {item.source}</small>
              </span>
              <Badge tone={item.status === "overdue" ? "danger" : "info"}>{statusLabel(item.status)}</Badge>
            </div>
          )) : <EmptyState icon={ListChecks} title="Majburiyat yo'q" text="Bu hujjatda hali saqlangan majburiyatlar topilmadi." />}
        </div>
      </Panel>
    </section>
  );
}

export function ObligationsWorkspace({ obligations, contracts, filter, onFilterChange, onUpdate, onCreateTask }: {
  obligations: Obligation[];
  contracts: Contract[];
  filter: ObligationStatus | "all";
  onFilterChange: (filter: ObligationStatus | "all") => void;
  onUpdate: (id: string, patch: Partial<Obligation>) => void;
  onCreateTask: (obligation: Obligation) => void;
}) {
  const visible = obligations.filter((item) => filter === "all" || item.status === filter);
  return (
    <section className="section-grid">
      <PageIntro
        icon={ListChecks}
        title="Majburiyatlar nazorati"
        subtitle="AI topgan majburiyatlar owner, deadline, status va vazifaga aylantirish bilan boshqariladi."
        items={[
          { label: "Jami", value: obligations.length, tone: "info" },
          { label: "Ko'rinmoqda", value: visible.length, tone: "neutral" },
          { label: "Kechikkan", value: obligations.filter((item) => item.status === "overdue").length, tone: obligations.some((item) => item.status === "overdue") ? "danger" : "neutral" },
          { label: "Review", value: obligations.filter((item) => item.status === "review").length, tone: "warning" },
        ]}
      />
      <div className="filter-bar">
        {["all", "active", "overdue", "review", "completed"].map((item) => (
          <button type="button" key={item} className={filter === item ? "segmented active" : "segmented"} onClick={() => onFilterChange(item as ObligationStatus | "all")}>{item === "all" ? "Hammasi" : statusLabel(item as ObligationStatus)}</button>
        ))}
      </div>
      <div className="table-card">
        {visible.length ? (
          <table>
            <thead>
              <tr>
                <th>Majburiyat</th>
                <th>Shartnoma</th>
                <th>Mas'ul</th>
                <th>Muddat</th>
                <th>Holat</th>
                <th><span className="sr-only">Amallar</span></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => {
                const contract = contracts.find((contractItem) => contractItem.id === item.contractId);
                return (
                  <tr key={item.id}>
                    <td data-label="Majburiyat">
                      <strong>{item.title}</strong>
                      <small>{item.source} · {item.confidence}%</small>
                    </td>
                    <td data-label="Shartnoma">{contract?.title ?? item.contractId}</td>
                    <td data-label="Mas'ul">
                      <select value={item.owner} onChange={(event) => onUpdate(item.id, { owner: event.target.value })} aria-label={`${item.title} mas'uli`}>
                        {employees.map((employee) => <option key={employee}>{employee}</option>)}
                      </select>
                    </td>
                    <td data-label="Muddat">{fmtDate(item.dueDate)}</td>
                    <td data-label="Holat"><Badge tone={item.status === "overdue" ? "danger" : item.status === "completed" ? "success" : "info"}>{statusLabel(item.status)}</Badge></td>
                    <td className="actions-cell" data-label="Amallar">
                      <button type="button" className="icon-button" title="Bajarildi" aria-label="Bajarildi" onClick={() => onUpdate(item.id, { status: "completed" })}><Check size={16} /></button>
                      <button type="button" className="icon-button" title="Vazifa yaratish" aria-label="Vazifa yaratish" onClick={() => onCreateTask(item)}><Plus size={16} /></button>
                      <button type="button" className="icon-button" title="Arxiv" aria-label="Arxiv" onClick={() => onUpdate(item.id, { status: "archived" })}><Archive size={16} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <EmptyState icon={ListChecks} title="Majburiyat yo'q" text="PDF tahlil qilib saqlangandan keyin majburiyatlar shu jadvalda chiqadi." />}
      </div>
    </section>
  );
}

export function TasksWorkspace({ tasks, contracts, onUpdate }: {
  tasks: Task[];
  contracts: Contract[];
  onUpdate: (id: string, patch: Partial<Task>) => void;
}) {
  const columns: Array<{ id: TaskStatus; title: string }> = [
    { id: "pending", title: "Kutilmoqda" },
    { id: "progress", title: "Jarayonda" },
    { id: "done", title: "Bajarildi" },
  ];
  return (
    <section className="kanban">
      <div className="kanban-wide">
        <PageIntro
          icon={FolderKanban}
          title="Vazifalar oqimi"
          subtitle="Risk va majburiyatlardan yaratilgan ishlar mas'ul, muddat va status bo'yicha yuradi."
          items={[
            { label: "Jami", value: tasks.length, tone: "info" },
            { label: "Kutilmoqda", value: tasks.filter((task) => task.status === "pending").length, tone: "warning" },
            { label: "Jarayonda", value: tasks.filter((task) => task.status === "progress").length, tone: "info" },
            { label: "Bajarildi", value: tasks.filter((task) => task.status === "done").length, tone: "success" },
          ]}
        />
      </div>
      {columns.map((column) => (
        <div className="kanban-column" key={column.id}>
          <div className="kanban-head">
            <h2>{column.title}</h2>
            <Badge tone="neutral">{tasks.filter((task) => task.status === column.id).length}</Badge>
          </div>
          {tasks.filter((task) => task.status === column.id).map((task) => {
            const contract = contracts.find((item) => item.id === task.contractId);
            return (
              <div className="task-card" key={task.id}>
                <div className="task-top">
                  <Badge tone={task.priority === "high" ? "danger" : task.priority === "medium" ? "warning" : "success"}>{riskLabel(task.priority)}</Badge>
                  <small>{fmtDate(task.dueDate)}</small>
                </div>
                <h3>{task.title}</h3>
                <p>{contract?.counterparty ?? task.contractId}</p>
                <div className="task-footer">
                  <span>{task.owner}</span>
                  <div className="button-row compact">
                    {column.id !== "pending" && <button className="icon-button" onClick={() => onUpdate(task.id, { status: "pending" })}><ArrowRight className="rotate-180" size={15} /></button>}
                    {column.id !== "done" && <button className="icon-button" onClick={() => onUpdate(task.id, { status: column.id === "pending" ? "progress" : "done" })}><ArrowRight size={15} /></button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </section>
  );
}

export function ComparisonWorkspace({ state, setState }: {
  state: ComparisonWorkspaceState;
  setState: React.Dispatch<React.SetStateAction<ComparisonWorkspaceState>>;
}) {
  const { reference, candidate, items } = state;
  const patchState = (patch: Partial<ComparisonWorkspaceState>) => setState((current) => ({ ...current, ...patch }));
  const runCompare = () => {
    const text = `${reference} ${candidate}`.toLowerCase();
    const generated: ComparisonItem[] = [
      {
        id: "CMP-1",
        clause: "To'lov muddati",
        reference: "30 kalendar kun",
        candidate: text.includes("45") ? "45 kalendar kun" : "30 kalendar kun",
        impact: text.includes("45") ? "Cashflow kechikishi mumkin" : "O'zgarish topilmadi",
        severity: text.includes("45") ? "medium" : "low",
      },
      {
        id: "CMP-2",
        clause: "Avto-uzaytirish",
        reference: "Alohida yozma kelishuv bilan",
        candidate: text.includes("auto") || text.includes("uzay") ? "Avtomatik uzayadi" : "Alohida kelishuv bilan",
        impact: text.includes("auto") || text.includes("uzay") ? "Renewal oynasi o'tkazib yuborilishi mumkin" : "Past risk",
        severity: text.includes("auto") || text.includes("uzay") ? "high" : "low",
      },
      {
        id: "CMP-3",
        clause: "Yurisdiksiya",
        reference: "O'zbekiston Respublikasi",
        candidate: text.includes("english law") ? "English law" : "O'zbekiston Respublikasi",
        impact: text.includes("english law") ? "Chet el huquqi tasdiq talab qiladi" : "Mos",
        severity: text.includes("english law") ? "high" : "low",
      },
    ];
    patchState({ items: generated });
  };

  return (
    <section className="workspace-grid comparison-grid">
      <div className="wide">
        <PageIntro
          icon={FileDiff}
          title="Bandlar taqqoslash"
          subtitle="Reference va candidate matnlar orasidagi commercial, renewal va jurisdiction farqlari ko'rsatiladi."
          items={[
            { label: "Reference", value: reference.trim() ? "Kiritilgan" : "Bo'sh", tone: reference.trim() ? "success" : "neutral" },
            { label: "Candidate", value: candidate.trim() ? "Kiritilgan" : "Bo'sh", tone: candidate.trim() ? "success" : "neutral" },
            { label: "Topilmalar", value: items.length, tone: items.length ? "warning" : "neutral" },
            { label: "Risk signal", value: items.some((item) => item.severity === "high") ? "Yuqori" : "Normal", tone: items.some((item) => item.severity === "high") ? "danger" : "success" },
          ]}
        />
      </div>
      <Panel title="Ikki hujjatni taqqoslash" subtitle="Reference va candidate versiyalar orasidagi band farqlari" icon={FileDiff}>
        <div className="compare-inputs">
          <label>
            Reference hujjat
            <textarea rows={8} value={reference} onChange={(event) => patchState({ reference: event.target.value })} placeholder="Asosiy matn yoki fayl nomi..." />
          </label>
          <label>
            Candidate hujjat
            <textarea rows={8} value={candidate} onChange={(event) => patchState({ candidate: event.target.value })} placeholder="Yangi versiya matni: 45 days, auto renewal, English law..." />
          </label>
        </div>
        <button type="button" className="primary-button" onClick={runCompare}><GitCompareArrows size={17} /> Taqqoslashni boshlash</button>
      </Panel>
      <Panel title="Taqqoslash natijasi" subtitle="Risk darajasi, ta'sir va tekshiruv izohi" icon={GitCompareArrows}>
        {items.length ? (
          <div className="comparison-list">
            {items.map((item) => (
              <div className="comparison-item" key={item.id}>
                <div>
                  <Badge tone={item.severity === "high" ? "danger" : item.severity === "medium" ? "warning" : "success"}>{riskLabel(item.severity)}</Badge>
                  <h3>{item.clause}</h3>
                  <p>{item.impact}</p>
                </div>
                <div className="diff-cols">
                  <span>{item.reference}</span>
                  <ArrowRight size={16} />
                  <span>{item.candidate}</span>
                </div>
              </div>
            ))}
          </div>
        ) : <EmptyState icon={FileDiff} title="Natija hali yo'q" text="Ikki matn kiriting va taqqoslashni ishga tushiring." />}
      </Panel>
    </section>
  );
}

export function TemplatesWorkspace({ templates, setTemplates, state, setState }: {
  templates: Template[];
  setTemplates: React.Dispatch<React.SetStateAction<Template[]>>;
  state: TemplateWorkspaceState;
  setState: React.Dispatch<React.SetStateAction<TemplateWorkspaceState>>;
}) {
  const { selectedId, fieldName, templateName, domain } = state;
  const selected = templates.find((item) => item.id === selectedId) ?? templates[0];
  const patchState = (patch: Partial<TemplateWorkspaceState>) => setState((current) => ({ ...current, ...patch }));

  const createTemplate = () => {
    if (!templateName.trim()) return;
    const id = makeId("TPL");
    const template: Template = {
      id,
      name: templateName.trim(),
      domain: domain.trim() || "Commercial",
      status: "staging",
      fields: [],
    };
    setTemplates((current) => [template, ...current]);
    patchState({ selectedId: id, templateName: "", domain: "Commercial" });
  };

  const addField = () => {
    if (!selected || !fieldName.trim()) return;
    const key = fieldName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    setTemplates((current) => current.map((template) => template.id === selected.id ? {
      ...template,
      fields: [...template.fields, { id: makeId("F"), label: fieldName.trim(), key: key || "custom_field", type: "text", example: "Namuna qiymat" }],
    } : template));
    patchState({ fieldName: "" });
  };

  return (
    <section className="workspace-grid templates-grid">
      <div className="wide">
        <PageIntro
          icon={Library}
          title="Shablon va maydonlar"
          subtitle="Reusable extraction template, placeholder va field library shu yerda tayyorlanadi."
          items={[
            { label: "Shablonlar", value: templates.length, tone: "info" },
            { label: "Tanlangan", value: selected ? selected.name : "Yo'q", tone: selected ? "success" : "neutral" },
            { label: "Maydonlar", value: selected?.fields.length ?? 0, tone: "neutral" },
            { label: "Holat", value: selected?.status ?? "staging", tone: selected?.status === "global" ? "success" : "warning" },
          ]}
        />
      </div>
      <Panel title="Maydonlar kutubxonasi" subtitle="AI topgan dinamik maydonlar va qayta ishlatiladigan shablonlar" icon={Library}>
        <div className="template-create">
          <input value={templateName} onChange={(event) => patchState({ templateName: event.target.value })} placeholder="Yangi shablon nomi" aria-label="Yangi shablon nomi" />
          <input value={domain} onChange={(event) => patchState({ domain: event.target.value })} placeholder="Domen" aria-label="Shablon domeni" />
          <button type="button" className="secondary-button" onClick={createTemplate}><Plus size={16} /> Shablon yaratish</button>
        </div>
        <div className="template-list">
          {templates.length ? templates.map((template) => (
            <button type="button" className={selected?.id === template.id ? "template-row selected" : "template-row"} key={template.id} onClick={() => patchState({ selectedId: template.id })}>
              <span>
                <strong>{template.name}</strong>
                <small>{template.domain} · {template.fields.length} maydon</small>
              </span>
              <Badge tone={template.status === "global" ? "success" : "warning"}>{template.status}</Badge>
            </button>
          )) : <EmptyState icon={Library} title="Shablon yo'q" text="Keyingi bosqichda AI extractiondan template yaratish ulanadi." />}
        </div>
      </Panel>
      <Panel title={selected?.name ?? "Shablon"} subtitle="Maydonlarni joylashtirish va namuna render" icon={SquarePen}>
        {selected ? (
          <div className="template-detail">
            <div className="button-row">
              <input value={fieldName} onChange={(event) => patchState({ fieldName: event.target.value })} placeholder="Yangi maydon nomi" aria-label="Yangi maydon nomi" />
              <button type="button" className="secondary-button" onClick={addField}><Plus size={16} /> Qo'shish</button>
            </div>
            <div className="field-table">
              {selected.fields.map((field) => (
                <div className="field-row" key={field.id}>
                  <strong>{field.label}</strong>
                  <code>{`{{${field.key}}}`}</code>
                  <Badge tone="neutral">{field.type}</Badge>
                  <span>{field.example}</span>
                </div>
              ))}
            </div>
            <div className="paper template-paper">
              <h3>{selected.name}</h3>
              <p>Ushbu shartnoma {selected.fields[0] ? `{{${selected.fields[0].key}}}` : "{{party}}"} va buyurtmachi o'rtasida tuziladi.</p>
              <p>Qiymat, muddat, mas'ul va SLA kabi maydonlar Field Library orqali hujjatga joylashtiriladi.</p>
              <p className="highlight">{selected.fields.map((field) => `${field.label}: {{${field.key}}}`).join(" · ")}</p>
            </div>
          </div>
        ) : <EmptyState icon={SquarePen} title="Shablon tanlanmagan" text="Hozircha default shablon yuklanmaydi." />}
      </Panel>
    </section>
  );
}

export function KnowledgeBaseWorkspace({ state, setState, onRefresh, onUpload, onDelete }: {
  state: KnowledgeWorkspaceState;
  setState: React.Dispatch<React.SetStateAction<KnowledgeWorkspaceState>>;
  onRefresh: () => void;
  onUpload: () => void;
  onDelete: (id: string) => void;
}) {
  const clientDocuments = state.documents.filter((document) => document.kind === "client");
  const systemDocuments = state.documents.filter((document) => document.kind === "system");
  const updateState = (patch: Partial<KnowledgeWorkspaceState>) => setState((current) => ({ ...current, ...patch }));

  return (
    <section className="section-grid">
      <PageIntro
        icon={BookOpen}
        title="Biznes bilim bazasi"
        subtitle="Client qo'llanmalari va system playbooklar AI qarorlarini RAG orqali asoslaydi."
        items={[
          { label: "Hujjatlar", value: state.stats?.documents ?? state.documents.length, tone: "info" },
          { label: "Client", value: clientDocuments.length, tone: clientDocuments.length ? "success" : "neutral" },
          { label: "System", value: systemDocuments.length, tone: "success" },
          { label: "Chunk", value: state.stats?.chunks ?? 0, tone: "warning" },
        ]}
      />
      <div className="kpi-row">
        <MetricCard icon={BookOpen} label="Qo'llanmalar" value={state.stats?.documents ?? state.documents.length} detail="system va client knowledge" />
        <MetricCard icon={Database} label="Bilim bo'laklari" value={state.stats?.chunks ?? 0} detail="AI foydalanadigan kontekst" tone="success" />
        <MetricCard icon={Library} label="Client hujjatlar" value={clientDocuments.length} detail="biznesga mos qoidalar" />
        <MetricCard icon={Brain} label="Asoslash" value="RAG" detail="taxmin emas, qoida asosida" tone="success" />
      </div>

      <div className="split-layout">
        <Panel title="Qo'llanma yuklash" subtitle="PDF, TXT, MD, CSV yoki JSON hujjatlarni AI bilim bazasiga qo'shing" icon={Upload}>
          <div className="form-grid">
            <label>
              Nomi
              <input value={state.title} onChange={(event) => updateState({ title: event.target.value })} placeholder="Masalan: Bitrix savdo pipeline qoidalari" />
            </label>
            <label>
              Yo'nalish
              <select value={state.domain} onChange={(event) => updateState({ domain: event.target.value })}>
                {["Legal", "Sales", "CRM", "Finance", "Operations", "Compliance", "HR", "Procurement", "Other"].map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>
              Til
              <select value={state.language} onChange={(event) => updateState({ language: event.target.value })}>
                <option value="mixed">Aralash</option>
                <option value="uz">O'zbek</option>
                <option value="ru">Русский</option>
                <option value="en">English</option>
              </select>
            </label>
            <label>
              Fayl
              <input
                type="file"
                accept="application/pdf,.pdf,.txt,.md,.markdown,.csv,.json"
                onChange={(event) => updateState({ selectedFile: event.target.files?.[0] ?? null, error: "" })}
              />
            </label>
            {state.selectedFile && (
              <div className="wide selected-file">
                <FileText size={18} />
                <span>{state.selectedFile.name}</span>
                <Badge tone="info">{(state.selectedFile.size / (1024 * 1024)).toFixed(2)} MB</Badge>
              </div>
            )}
            {state.error && <div className="wide error-box">{state.error}</div>}
            <div className="wide upload-rules">
              <div><CheckCircle2 size={16} /> CRM script, Bitrix/amoCRM stage, approval matrix va risk playbooklar qabul qilinadi</div>
              <div><CheckCircle2 size={16} /> Hujjat AI orqali grounding qoidalarga aylantiriladi</div>
              <div><CheckCircle2 size={16} /> Keyingi PDF tahlilda shu biznes qoidalari RAG context sifatida ishlatiladi</div>
              <div><CheckCircle2 size={16} /> System playbooklar o'chirilmaydi, client hujjatlar boshqariladi</div>
            </div>
            <div className="wide action-row">
              <button type="button" className="secondary-button" onClick={onRefresh} disabled={state.isLoading}>
                <RefreshCw size={16} /> Yangilash
              </button>
              <button type="button" className="primary-button" onClick={onUpload} disabled={!state.selectedFile || state.isUploading}>
                <Sparkles size={16} /> {state.isUploading ? "AI o'qiyapti..." : "Bilim bazasiga qo'shish"}
              </button>
            </div>
          </div>
        </Panel>

        <Panel title="Ishlash prinsipi" subtitle="Bu qism har biznesni o'z qoidalariga moslaydi" icon={Brain}>
          <div className="principle-list">
            <div>
              <strong>1. Hujjat ingest</strong>
              <span>Client qo'llanma, CRM script yoki qonuniy checklist yuklaydi.</span>
            </div>
            <div>
              <strong>2. AI normalizatsiya</strong>
              <span>Vertex hujjatni qaror qoidalari, threshold, stage va risk kriteriylariga ajratadi.</span>
            </div>
            <div>
              <strong>3. RAG grounding</strong>
              <span>PDF tahlilda kerakli qoida promptga qo'shiladi; AI taxmin emas, manbaga tayanadi.</span>
            </div>
            <div>
              <strong>4. Evaluation</strong>
              <span>Natija golden dataset bilan o'lchanadi, past joylar playbook/prompt orqali tuzatiladi.</span>
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="Bilim bazasi hujjatlari" subtitle="System playbooklar va client tomonidan yuklangan qo'llanmalar" icon={BookOpen}>
        {state.isLoading ? (
          <EmptyState icon={RefreshCw} title="Yuklanmoqda" text="Bilim bazasi ro'yxati olinmoqda." />
        ) : state.documents.length ? (
          <div className="knowledge-list">
            {state.documents.map((document) => (
              <article className="knowledge-item" key={document.id}>
                <div className="knowledge-main">
                  <div>
                    <Badge tone={document.kind === "client" ? "info" : "success"}>{document.kind === "client" ? "Client" : "System"}</Badge>
                    <h3>{document.title}</h3>
                    <p>{document.domain} · {document.language} · {document.chunks} chunk · {document.sourceFileName}</p>
                  </div>
                  {document.tags?.length ? (
                    <div className="tag-row">
                      {document.tags.slice(0, 6).map((tag) => <span key={tag}>{tag}</span>)}
                    </div>
                  ) : null}
                </div>
                <div className="knowledge-actions">
                  <small>{document.uploadedAt ? fmtDate(document.uploadedAt) : "System"}</small>
                  {document.kind === "client" && (
                    <button type="button" className="icon-button danger" onClick={() => onDelete(document.id)} title="O'chirish" aria-label={`${document.title} hujjatini o'chirish`}>
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState icon={BookOpen} title="Bilim bazasi bo'sh" text="Client qo'llanmasini yuklang, AI keyingi tahlillarda shu qoidalarga tayanadi." />
        )}
      </Panel>

      <div className="split-layout">
        <Panel title="System playbooklar" subtitle="Platformaning umumiy legal/RAG qoidalari" icon={Library}>
          <div className="compact-list">
            {systemDocuments.map((document) => (
              <div className="compact-row" key={document.id}>
                <CheckCircle2 size={16} />
                <span>{document.title}</span>
                <Badge tone="success">{document.domain}</Badge>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Client moslashuv" subtitle="Har bir biznes uchun alohida qaror qoidalari" icon={Settings}>
          <div className="compact-list">
            {clientDocuments.length ? clientDocuments.slice(0, 5).map((document) => (
              <div className="compact-row" key={document.id}>
                <Database size={16} />
                <span>{document.title}</span>
                <Badge tone="info">{document.domain}</Badge>
              </div>
            )) : <EmptyState icon={Database} title="Client qoida yo'q" text="Bitrix, amoCRM yoki ichki playbook yuklang." />}
          </div>
        </Panel>
      </div>
    </section>
  );
}

export function AnalyticsWorkspace({ contracts, obligations, tasks }: { contracts: Contract[]; obligations: Obligation[]; tasks: Task[] }) {
  const riskCounts = {
    high: contracts.reduce((sum, contract) => sum + contract.risks.filter((risk) => risk.severity === "high").length, 0),
    medium: contracts.reduce((sum, contract) => sum + contract.risks.filter((risk) => risk.severity === "medium").length, 0),
    low: contracts.reduce((sum, contract) => sum + contract.risks.filter((risk) => risk.severity === "low").length, 0),
  };
  const workload = employees.map((employee) => ({
    employee,
    count: tasks.filter((task) => task.owner === employee && task.status !== "done").length + obligations.filter((obligation) => obligation.owner === employee && obligation.status !== "completed").length,
  }));
  return (
    <section className="section-grid">
      <PageIntro
        icon={BarChart3}
        title="Analytics"
        subtitle="Risk, majburiyat statusi va mas'ullar workload signallari boshqaruv uchun jamlanadi."
        items={[
          { label: "Yuqori risk", value: riskCounts.high, tone: riskCounts.high ? "danger" : "neutral" },
          { label: "O'rta risk", value: riskCounts.medium, tone: "warning" },
          { label: "Majburiyat", value: obligations.length, tone: "info" },
          { label: "Vazifa", value: tasks.length, tone: "success" },
        ]}
      />
      <div className="split-layout">
        <Panel title="AI risk kategoriyalari" subtitle="High, medium, low topilmalar" icon={BarChart3}>
          <Bar label="Yuqori" value={riskCounts.high} max={Math.max(3, riskCounts.high, riskCounts.medium, riskCounts.low)} tone="danger" />
          <Bar label="O'rta" value={riskCounts.medium} max={Math.max(3, riskCounts.high, riskCounts.medium, riskCounts.low)} tone="warning" />
          <Bar label="Past" value={riskCounts.low} max={Math.max(3, riskCounts.high, riskCounts.medium, riskCounts.low)} tone="success" />
        </Panel>
        <Panel title="Majburiyat statuslari" subtitle="Ish navbati sog'ligi" icon={Activity}>
          {["active", "overdue", "review", "completed"].map((status) => (
            <Bar key={status} label={statusLabel(status as ObligationStatus)} value={obligations.filter((item) => item.status === status).length} max={Math.max(1, obligations.length)} tone={status === "overdue" ? "danger" : status === "completed" ? "success" : "info"} />
          ))}
        </Panel>
      </div>
      <Panel title="Workload" subtitle="Mas'ullar bo'yicha ochiq ishlar" icon={Users}>
        <div className="workload-grid">
          {workload.map((item) => (
            <div className="workload-card" key={item.employee}>
              <strong>{item.employee}</strong>
              <span>{item.count} ochiq ish</span>
              <div className="mini-progress"><i style={{ width: `${Math.min(100, item.count * 18)}%` }} /></div>
            </div>
          ))}
        </div>
      </Panel>
    </section>
  );
}

export function StaffWorkspace({ proposals, onAddProposal, onUpdate }: {
  proposals: Proposal[];
  onAddProposal: (files: FileList | null) => void;
  onUpdate: (id: string, status: ProposalStatus) => void;
}) {
  return (
    <section className="workspace-grid staff-grid">
      <div className="wide">
        <PageIntro
          icon={FlaskConical}
          title="AI Lab"
          subtitle="AI prompt, template va guardrail takliflari stagingdan global katalogga o'tkaziladi."
          items={[
            { label: "Takliflar", value: proposals.length, tone: "info" },
            { label: "Testing", value: proposals.filter((proposal) => proposal.status === "testing").length, tone: "warning" },
            { label: "Approved", value: proposals.filter((proposal) => proposal.status === "approved").length, tone: "success" },
            { label: "Global", value: proposals.filter((proposal) => proposal.status === "promoted").length, tone: "success" },
          ]}
        />
      </div>
      <Panel title="AI sozlash" subtitle="Reference hujjatlardan domen, shablon va prompt takliflari tayyorlanadi" icon={FlaskConical}>
        <div className="prompt-grid">
          <div className="prompt-box">
            <strong>Domen konteksti</strong>
            <p>Domen bo'yicha umumiy kontekst: hujjat klassi, yuridik terminlar, til va extraction chegaralari.</p>
          </div>
          <div className="prompt-box">
            <strong>Tekshiruv ro'yxati</strong>
            <p>Sub-type uchun aynan nimalarni ajratish: tomonlar, qiymat, muddat, risk, majburiyat, confidence va citation.</p>
          </div>
          <div className="prompt-box">
            <strong>Review qoidalari</strong>
            <p>Past confidence, noaniq bandlar va policy limitlar inson ko'rigiga yuboriladi.</p>
          </div>
        </div>
        <label className="file-action">
          <Upload size={17} />
          Reference hujjatlar yuklash
          <input type="file" accept="application/pdf,.pdf" multiple onChange={(event) => onAddProposal(event.target.files)} />
        </label>
      </Panel>
      <Panel title="Sinovdagi takliflar" subtitle="Tekshiruvdan global kataloggacha bo'lgan oqim" icon={Settings}>
        <div className="proposal-list">
          {proposals.length ? proposals.map((proposal) => (
            <div className="proposal-card" key={proposal.id}>
              <div>
                <Badge tone={proposal.kind === "domain" ? "info" : "neutral"}>{proposal.kind}</Badge>
                <h3>{proposal.title}</h3>
                <p>{proposal.summary}</p>
                <small>Confidence: {proposal.confidence}%</small>
              </div>
              <div className="proposal-actions">
                <Badge tone={proposal.status === "promoted" ? "success" : proposal.status === "discarded" ? "danger" : "warning"}>{statusLabel(proposal.status)}</Badge>
                <button type="button" className="secondary-button" onClick={() => onUpdate(proposal.id, "testing")}>Sinash</button>
                <button type="button" className="secondary-button" onClick={() => onUpdate(proposal.id, "approved")}>Tasdiqlash</button>
                <button type="button" className="primary-button" onClick={() => onUpdate(proposal.id, "promoted")}>Global qilish</button>
                <button type="button" className="icon-button" aria-label="Rad etish" onClick={() => onUpdate(proposal.id, "discarded")}><Trash2 size={16} /></button>
              </div>
            </div>
          )) : <EmptyState icon={FlaskConical} title="Staging bo'sh" text="Default proposal yo'q; staff authoring backend ulanganda takliflar shu yerga tushadi." />}
        </div>
      </Panel>
    </section>
  );
}

export function DeepAnalysis() {
  const modules = [
    ["Landing/demo", "Demo request, multilingual marketing, waitlist endpoint, enterprise promise."],
    ["Auth/roles", "Phone +998 and password login, access/refresh token, user/staff/employee route guards."],
    ["AI review", "PDF-only upload, multilingual Vertex classification/extraction, uploaded -> classifying -> extracting -> done status pipeline."],
    ["Contract detail", "Extracted fields, risk findings, obligations, source page citations, confidence score and re-extract."],
    ["Obligations/tasks", "Deadline, owner, recurring/one-time type, task routing, file attachments and status updates."],
    ["Templates", "Field categories/types/groups, Word template import, dynamic placeholder placement, global templates."],
    ["Comparison", "Reference and candidate document upload, side-by-side result, clause-level difference review."],
    ["Staff lab", "AI config, authoring proposals, staging/testing, approval, promote to global catalog."],
    ["Analytics/audit", "AI risk, common errors, workload, obligation status, audit events and branch context."],
  ];
  const operations = [
    "Hujjat yuklash va tip/sub-tip aniqlash",
    "Maydonlarni strukturaga ajratish: tomonlar, qiymat, muddat, huquq, bank rekvizitlari",
    "Risklarni chiqarish: yuqori risk, qarama-qarshi shart, yetishmayotgan band",
    "Majburiyatlarni topish, owner berish, deadline qo'yish va queuega chiqarish",
    "Manba band/sahifa/citation bilan natijani tekshirish",
    "Wrong type bo'lsa manual sub-type tanlash va qayta extraction",
    "Unselected majburiyatlarni o'chirib, faqat tasdiqlanganlarini saqlash",
    "Shartnoma template maydonlarini joylashtirish va render qilish",
    "Ikki versiyani taqqoslash va farq risklarini ko'rsatish",
  ];
  return (
    <section className="analysis-page">
      <PageIntro
        icon={Brain}
        title="Kotib tahlili"
        subtitle="Legal SaaS modullari, hujjat amallari va terminlar bitta reference sahifada jamlangan."
        items={[
          { label: "Modullar", value: modules.length, tone: "info" },
          { label: "Amallar", value: operations.length, tone: "success" },
          { label: "Terminlar", value: 6, tone: "neutral" },
          { label: "Scope", value: "Legal AI", tone: "warning" },
        ]}
      />
      <Panel title="Kotib Legal bo'yicha chuqur kuzatuv" subtitle="Ommaviy sayt, frontend bundle nomlari, route/API izlari va UI matnlaridan chiqarilgan tahlil" icon={Brain}>
        <div className="analysis-copy">
          <p>
            Kotib Legal kontrakt hayot siklini boshqaradigan AI SaaS. Asosiy ishlash prinsipi:
            hujjat qabul qilinadi, AI uni domen/sub-type bo'yicha klassifikatsiya qiladi, keyin shartnoma
            maydonlari, risklar va majburiyatlar strukturaga ajratiladi. Inson review bosqichida past
            confidence, noto'g'ri type, risk va owner masalalarini tasdiqlaydi.
          </p>
          <p>
            Frontend route va API izlariga qaraganda tizim oddiy chat emas: kontrakt reyestri, majburiyat
            navbati, vazifa menejeri, kontragent/employee/department management, analytics, audit, branch/HQ
            konteksti va staff-only AI authoring modullaridan iborat.
          </p>
        </div>
        <div className="analysis-matrix">
          {modules.map(([title, desc]) => (
            <div key={title}>
              <strong>{title}</strong>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Hujjatlar bilan bajariladigan amallar" subtitle="Alternativa qurishda funksional scope" icon={ClipboardList}>
        <div className="operation-grid">
          {operations.map((operation, index) => (
            <div className="operation" key={operation}>
              <span>{index + 1}</span>
              <p>{operation}</p>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Vazifalar ma'nolari" subtitle="Mahsulot ichidagi terminlar oddiy tilda" icon={FileSearch}>
        <div className="term-list">
          <KeyValue label="Classification" value="Hujjat qaysi domen va sub-typega tegishli ekanini aniqlash." />
          <KeyValue label="Extraction" value="Matndan maydon, band, majburiyat va risklarni strukturali JSONga ajratish." />
          <KeyValue label="Confidence" value="AI topgan qiymatga ishonch darajasi; past bo'lsa inson tekshiradi." />
          <KeyValue label="Citation" value="Natija qaysi band/betdan olinganini ko'rsatadigan manba havolasi." />
          <KeyValue label="Re-extract" value="Hujjatni qayta tahlil qilib AI natijalarini yangilash." />
          <KeyValue label="Staging/Promote" value="Staff sinagan prompt yoki template global katalogga chiqarilishidan oldingi bosqich." />
        </div>
      </Panel>
    </section>
  );
}

function stageIndex(stage: AnalysisRun["stage"]) {
  return ["uploaded", "classifying", "extracting", "done"].indexOf(stage);
}
