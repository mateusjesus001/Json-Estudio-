import { useMemo, useRef, useState } from "react";
import {
  Braces,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clipboard,
  Code2,
  Columns2,
  Copy,
  Download,
  FileJson,
  FilePlus2,
  FolderOpen,
  GitCompareArrows,
  IndentIncrease,
  Maximize2,
  Menu,
  Minimize2,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Search,
  Settings2,
  Sparkles,
  Sun,
  TreePine,
  Upload,
  WandSparkles,
  X,
} from "lucide-react";

type Module = "editor" | "tree" | "compare" | "converter" | "search" | "schema";

const sampleJSON = `{
  "project": "Atlas API",
  "version": "2.4.0",
  "environment": "production",
  "services": [
    {
      "name": "auth-service",
      "status": "healthy",
      "port": 3001,
      "replicas": 3
    },
    {
      "name": "billing-worker",
      "status": "degraded",
      "port": 3002,
      "replicas": 2
    }
  ],
  "features": {
    "auditLogs": true,
    "rateLimit": 1200,
    "experimental": null
  }
}`;

const compareJSON = `{
  "project": "Atlas API",
  "version": "2.5.0",
  "environment": "production",
  "services": [
    {
      "name": "auth-service",
      "status": "healthy",
      "port": 3001,
      "replicas": 4
    },
    {
      "name": "billing-worker",
      "status": "healthy",
      "port": 3002,
      "replicas": 2
    },
    {
      "name": "events-gateway",
      "status": "healthy",
      "port": 3003,
      "replicas": 2
    }
  ],
  "features": {
    "auditLogs": true,
    "rateLimit": 2000
  }
}`;

const sampleSchema = `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["project", "version", "services"],
  "properties": {
    "project": { "type": "string" },
    "version": { "type": "string" },
    "services": { "type": "array" }
  }
}`;

const navItems: { id: Module; label: string; hint: string; icon: typeof Braces }[] = [
  { id: "editor", label: "Editor JSON", hint: "Formatar e editar", icon: Braces },
  { id: "tree", label: "Explorador", hint: "Navegar em árvore", icon: TreePine },
  { id: "compare", label: "Comparar", hint: "Encontrar diferenças", icon: GitCompareArrows },
  { id: "converter", label: "Conversor", hint: "JSON, YAML e XML", icon: Code2 },
  { id: "search", label: "Pesquisar", hint: "Consultar caminhos", icon: Search },
  { id: "schema", label: "JSON Schema", hint: "Validar contrato", icon: Check },
];

const moduleMeta: Record<Module, { eyebrow: string; title: string; description: string }> = {
  editor: {
    eyebrow: "DOCUMENTOJSON",
    title: "Editor JSON",
    description: "Formate, valide e refine seus documentos em um workspace focado.",
  },
  tree: {
    eyebrow: "NOJSON",
    title: "Explorador de dados",
    description: "Navegue pela estrutura, tipos e caminhos do documento.",
  },
  compare: {
    eyebrow: "COMPARADORJSON",
    title: "Comparar documentos",
    description: "Visualize alterações entre versões lado a lado.",
  },
  converter: {
    eyebrow: "CONVERSORFORMATOS",
    title: "Conversor de formatos",
    description: "Transforme dados entre JSON, YAML e XML.",
  },
  search: {
    eyebrow: "PESQUISADOR",
    title: "Pesquisar no documento",
    description: "Encontre propriedades, valores e caminhos rapidamente.",
  },
  schema: {
    eyebrow: "VALIDADORSCHEMA",
    title: "Validador JSON Schema",
    description: "Valide seu documento contra um contrato explícito.",
  },
};

function parseJSON(text: string) {
  try {
    return { data: JSON.parse(text), error: "" };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : "JSON inválido" };
  }
}

function checkType(value: unknown, type: string | string[]): boolean {
  const types = Array.isArray(type) ? type : [type];
  return types.some((t) => {
    switch (t) {
      case "string":
        return typeof value === "string";
      case "number":
        return typeof value === "number" && !Number.isNaN(value);
      case "integer":
        return Number.isInteger(value);
      case "boolean":
        return typeof value === "boolean";
      case "object":
        return typeof value === "object" && value !== null && !Array.isArray(value);
      case "array":
        return Array.isArray(value);
      case "null":
        return value === null;
      default:
        return true;
    }
  });
}

function coerceType(value: unknown, expectedType: string | string[]): unknown {
  const types = Array.isArray(expectedType) ? expectedType : [expectedType];

  // Já está no tipo esperado — não altera
  if (types.some((t) => checkType(value, t))) return value;

  // Tenta converter de forma segura
  for (const t of types) {
    if (t === "number" && typeof value === "string") {
      const n = Number(value);
      if (!Number.isNaN(n)) return n;
    }
    if (t === "integer" && typeof value === "string") {
      const n = Number(value);
      if (Number.isInteger(n)) return n;
    }
    if (t === "boolean" && typeof value === "string") {
      if (value === "true") return true;
      if (value === "false") return false;
    }
    if (t === "string" && value !== null && value !== undefined) {
      return String(value);
    }
  }
  return value;
}

function bytesLabel(text: string) {
  return `${new Blob([text]).size.toLocaleString("pt-BR")} B`;
}

function lineCount(text: string) {
  return text.split("\n").length;
}

function basicYaml(value: unknown, depth = 0): string {
  const pad = "  ".repeat(depth);
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === "object" && item !== null
          ? `${pad}-\n${basicYaml(item, depth + 1)}`
          : `${pad}- ${String(item)}`,
      )
      .join("\n");
  }
  if (typeof value === "object" && value !== null) {
    return Object.entries(value)
      .map(([key, val]) => {
        if (typeof val === "object" && val !== null)
          return `${pad}${key}:\n${basicYaml(val, depth + 1)}`;
        return `${pad}${key}: ${val === null ? "null" : String(val)}`;
      })
      .join("\n");
  }
  return `${pad}${String(value)}`;
}

function basicXml(value: unknown, root = "root", depth = 0): string {
  const pad = "  ".repeat(depth);
  if (Array.isArray(value)) {
    return value.map((item) => basicXml(item, "item", depth)).join("\n");
  }
  if (typeof value === "object" && value !== null) {
    const body = Object.entries(value)
      .map(([key, val]) => basicXml(val, key, depth + 1))
      .join("\n");
    return `${pad}<${root}>\n${body}\n${pad}</${root}>`;
  }
  return `${pad}<${root}>${value === null ? "" : String(value)}</${root}>`;
}

function collectMatches(
  value: unknown,
  term: string,
  path = "$",
): { path: string; value: string; type: string }[] {
  const results: { path: string; value: string; type: string }[] = [];
  if (!term.trim()) return results;
  const needle = term.toLowerCase();
  if (typeof value === "object" && value !== null) {
    Object.entries(value).forEach(([key, child]) => {
      const childPath = Array.isArray(value) ? `${path}[${key}]` : `${path}.${key}`;
      const shown = typeof child === "object" ? JSON.stringify(child) : String(child);
      if (key.toLowerCase().includes(needle) || shown.toLowerCase().includes(needle)) {
        results.push({
          path: childPath,
          value: shown,
          type: Array.isArray(child) ? "array" : child === null ? "null" : typeof child,
        });
      }
      results.push(...collectMatches(child, term, childPath));
    });
  }
  return results;
}

function CodeArea({
  value,
  onChange,
  label,
  readOnly = false,
  error,
}: {
  value: string;
  onChange?: (value: string) => void;
  label: string;
  readOnly?: boolean;
  error?: string;
}) {
  return (
    <div className={`code-panel ${error ? "code-panel-error" : ""}`}>
      <div className="panel-title">
        <div className="panel-title-left">
          <FileJson size={15} />
          <span>{label}</span>
          {!error && (
            <span className="valid-dot">
              <Check size={10} />
            </span>
          )}
        </div>
        <span className="muted-label">{lineCount(value)} linhas</span>
      </div>
      <div className="editor-wrap">
        <div className="line-numbers" aria-hidden="true">
          {value.split("\n").map((_, index) => (
            <span key={index}>{index + 1}</span>
          ))}
        </div>
        <textarea
          aria-label={label}
          className="code-textarea"
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          readOnly={readOnly}
          spellCheck={false}
        />
      </div>
      {error && (
        <div className="inline-error">
          <CircleAlert size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

function TreeNode({
  name,
  value,
  path = "$",
  depth = 0,
}: {
  name: string;
  value: unknown;
  path?: string;
  depth?: number;
}) {
  const [open, setOpen] = useState(depth < 2);
  const isObject = typeof value === "object" && value !== null;
  const isArray = Array.isArray(value);
  const childEntries = isObject ? Object.entries(value) : [];
  const type = isArray
    ? "array"
    : value === null
      ? "null"
      : typeof value === "object"
        ? "object"
        : typeof value;
  const valueClass = `tree-value tree-${type}`;

  return (
    <div className="tree-node">
      <button
        className="tree-row"
        onClick={() => isObject && setOpen(!open)}
        style={{ paddingLeft: `${12 + depth * 22}px` }}
      >
        <span className="tree-chevron">
          {isObject ? open ? <ChevronDown size={15} /> : <ChevronRight size={15} /> : <span />}
        </span>
        <span className={`type-pill type-${type}`}>
          {type === "object" ? "{}" : type === "array" ? "[]" : type.slice(0, 3)}
        </span>
        <span className="tree-key">{name}</span>
        {isObject ? (
          <span className="tree-count">
            {isArray ? `[${childEntries.length}]` : `{${childEntries.length}}`}
          </span>
        ) : (
          <span className={valueClass}>{value === null ? "null" : String(value)}</span>
        )}
        <span className="tree-path">{path}</span>
      </button>
      {open &&
        childEntries.map(([key, child]) => (
          <TreeNode
            key={key}
            name={isArray ? `[${key}]` : key}
            value={child}
            path={isArray ? `${path}[${key}]` : `${path}.${key}`}
            depth={depth + 1}
          />
        ))}
    </div>
  );
}

function App() {
  const [module, setModule] = useState<Module>("editor");
  const [document, setDocument] = useState(sampleJSON);
  const [compareDocument, setCompareDocument] = useState(compareJSON);
  const [schema, setSchema] = useState(sampleSchema);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dark, setDark] = useState(true);
  const [toast, setToast] = useState("");
  const [searchTerm, setSearchTerm] = useState("status");
  const [requiredFieldValues, setRequiredFieldValues] = useState<Record<string, string>>({});
  const [searchMode, setSearchMode] = useState<"ambos" | "propriedade" | "valor">("ambos");
  const [formatTarget, setFormatTarget] = useState<"YAML" | "XML">("YAML");
  const [indent, setIndent] = useState(2);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => parseJSON(document), [document]);
  const comparedParsed = useMemo(() => parseJSON(compareDocument), [compareDocument]);
  const schemaParsed = useMemo(() => parseJSON(schema), [schema]);
  const matches = useMemo(() => {
    const all = collectMatches(parsed.data, searchTerm);
    if (searchMode === "ambos") return all;
    return all.filter((match) => {
      const lastPart = match.path.split(".").at(-1) ?? "";
      return searchMode === "propriedade"
        ? lastPart.toLowerCase().includes(searchTerm.toLowerCase())
        : match.value.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [parsed.data, searchTerm, searchMode]);

  const conversion = useMemo(() => {
    if (parsed.error) return "";
    return formatTarget === "YAML" ? basicYaml(parsed.data) : basicXml(parsed.data);
  }, [parsed, formatTarget]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }

  function formatDocument() {
    if (parsed.error) return notify("Corrija o JSON antes de formatar.");
    setDocument(JSON.stringify(parsed.data, null, indent));
    notify(`Documento formatado com ${indent} espaços.`);
  }

  function minifyDocument() {
    if (parsed.error) return notify("Corrija o JSON antes de minificar.");
    setDocument(JSON.stringify(parsed.data));
    notify("Documento minificado.");
  }

  function copyText(text: string, message = "Copiado para a área de transferência.") {
    navigator.clipboard?.writeText(text);
    notify(message);
  }

  function exportDocument(text = document, extension = "json") {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = `atlas-document.${extension.toLowerCase()}`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify("Arquivo exportado.");
  }

  function importDocument(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setDocument(String(reader.result ?? ""));
      notify(`${file.name} importado.`);
    };
    reader.readAsText(file);
  }

  function resetWorkspace() {
    setDocument(sampleJSON);
    setCompareDocument(compareJSON);
    setSchema(sampleSchema);
    notify("Exemplos restaurados.");
  }

  function autoFixDocument() {
    if (parsed.error || schemaParsed.error) {
      return notify("Corrija a sintaxe JSON antes de tentar corrigir.");
    }

    const schema = schemaParsed.data ?? {};
    let data = JSON.parse(JSON.stringify(parsed.data ?? {}));
    let fixed = 0;
    const needsManual: string[] = [];

    // Campos obrigatórios ausentes: não dá para adivinhar o valor
    const required = Array.isArray(schema.required) ? schema.required : [];
    for (const key of required) {
      if (!(key in data)) {
        needsManual.push(key);
      }
    }

    // Corrige tipos de propriedades quando é seguro
    const properties = schema.properties ?? {};
    for (const [key, propSchema] of Object.entries(properties)) {
      if (!(key in data)) continue;
      const value = data[key];
      if (propSchema && typeof propSchema === "object" && "type" in propSchema) {
        const coerced = coerceType(value, propSchema.type);
        if (coerced !== value) {
          data[key] = coerced;
          fixed++;
        }
      }
    }

    setDocument(JSON.stringify(data, null, indent));

    if (fixed > 0 && needsManual.length > 0) {
      notify(`${fixed} correção(s) aplicada(s). Preencha manualmente: ${needsManual.join(", ")}`);
    } else if (fixed > 0) {
      notify(`${fixed} correção(s) aplicada(s).`);
    } else if (needsManual.length > 0) {
      notify(`Nenhuma correção automática possível. Preencha manualmente: ${needsManual.join(", ")}`);
    } else {
      notify("Nenhum erro de tipo para corrigir automaticamente.");
    }
  }

  function fillRequiredFields() {
    if (parsed.error) {
      return notify("Corrija a sintaxe JSON antes de preencher campos.");
    }

    const schema = schemaParsed.data ?? {};
    const required = Array.isArray(schema.required) ? schema.required : [];
    const properties = schema.properties ?? {};
    const missing = required.filter((key: string) => !(key in (parsed.data ?? {})));

    if (missing.length === 0) {
      return notify("Não há campos obrigatórios ausentes.");
    }

    let data = JSON.parse(JSON.stringify(parsed.data ?? {}));
    let filled = 0;

    for (const key of missing) {
      const value = requiredFieldValues[key];
      if (value === undefined || value === "") continue;

      const propSchema = properties[key];
      const expectedType = propSchema && typeof propSchema === "object" ? propSchema.type : undefined;

      // Para array e object, tenta interpretar como JSON real
      if (expectedType === "array" || expectedType === "object") {
        try {
          data[key] = JSON.parse(value);
          filled++;
          continue;
        } catch {
          // Se não for JSON válido, usa valor padrão vazio conforme o tipo
          data[key] = expectedType === "array" ? [] : {};
          filled++;
          continue;
        }
      }

      // Para number, tenta converter
      if (expectedType === "number" || expectedType === "integer") {
        const n = Number(value);
        if (!Number.isNaN(n)) {
          data[key] = expectedType === "integer" && !Number.isInteger(n) ? Math.round(n) : n;
          filled++;
          continue;
        }
      }

      // Para boolean
      if (expectedType === "boolean") {
        if (value === "true") {
          data[key] = true;
          filled++;
          continue;
        }
        if (value === "false") {
          data[key] = false;
          filled++;
          continue;
        }
      }

      // Para string (ou qualquer outro tipo não tratado acima), deixa como texto
      data[key] = value;
      filled++;
    }

    setDocument(JSON.stringify(data, null, indent));
    setRequiredFieldValues({});
    notify(`${filled} campo(s) preenchido(s).`);
  }

  const schemaErrors = useMemo(() => {
    if (parsed.error || schemaParsed.error) return [];
    const errors: Array<{ path: string; message: string; rule: string }> = [];
    const data = parsed.data ?? {};
    const schema = schemaParsed.data ?? {};

    // required
    const required = Array.isArray(schema.required) ? schema.required : [];
    for (const key of required) {
      if (!(key in data)) {
        errors.push({
          path: `$.${key}`,
          message: `A propriedade obrigatória "${key}" não foi encontrada.`,
          rule: "required",
        });
      }
    }

    // type raiz
    if (schema.type && !checkType(data, schema.type)) {
      const tipo = Array.isArray(schema.type) ? schema.type.join(" | ") : schema.type;
      errors.push({
        path: "$",
        message: `O documento deve ser do tipo "${tipo}".`,
        rule: "type",
      });
    }

    // properties (tipo de cada propriedade definida no schema)
    const properties =
      schema.properties && typeof schema.properties === "object" ? schema.properties : {};
    for (const [key, propSchema] of Object.entries(properties)) {
      if (!(key in data)) continue; // "required" já cobre propriedades ausentes
      const value = (data as Record<string, unknown>)[key];
      if (propSchema && typeof propSchema === "object" && "type" in propSchema) {
        const tipo = Array.isArray(propSchema.type) ? propSchema.type.join(" | ") : propSchema.type;
        if (!checkType(value, propSchema.type)) {
          errors.push({
            path: `$.${key}`,
            message: `A propriedade "${key}" deve ser do tipo "${tipo}".`,
            rule: "type",
          });
        }
      }
    }

    return errors;
  }, [parsed, schemaParsed]);

  const compareStats = useMemo(() => {
    if (parsed.error || comparedParsed.error) return { added: 0, removed: 0, modified: 0 };
    const left = parsed.data ?? {};
    const right = comparedParsed.data ?? {};
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    let added = 0;
    let removed = 0;
    let modified = 0;
    keys.forEach((key) => {
      if (!(key in left)) added += 1;
      else if (!(key in right)) removed += 1;
      else if (JSON.stringify(left[key]) !== JSON.stringify(right[key])) modified += 1;
    });
    return { added, removed, modified };
  }, [parsed, comparedParsed]);

  const renderContent = () => {
    if (module === "editor") {
      return (
        <div className="module-content editor-module">
          <div className="actionbar">
            <div className="action-group">
              <button className="primary-button" onClick={formatDocument}>
                <WandSparkles size={16} />
                Formatar
              </button>
              <button className="tool-button" onClick={minifyDocument}>
                <Minimize2 size={16} />
                Minificar
              </button>
              <button className="tool-button" onClick={() => setDocument("")}>
                <X size={16} />
                Limpar
              </button>
            </div>
            <div className="action-group">
              <label className="select-wrap">
                Indentação
                <select value={indent} onChange={(e) => setIndent(Number(e.target.value))}>
                  <option value={2}>2 espaços</option>
                  <option value={4}>4 espaços</option>
                </select>
              </label>
              <button className="icon-button" title="Copiar" onClick={() => copyText(document)}>
                <Copy size={17} />
              </button>
              <button className="icon-button" title="Exportar" onClick={() => exportDocument()}>
                <Download size={17} />
              </button>
            </div>
          </div>
          <CodeArea
            value={document}
            onChange={setDocument}
            label="atlas-config.json"
            error={parsed.error}
          />
        </div>
      );
    }

    if (module === "tree") {
      return (
        <div className="module-content tree-layout">
          <div className="tree-toolbar">
            <div className="search-box">
              <Search size={16} />
              <input placeholder="Filtrar nós ou caminhos..." />
            </div>
            <div className="action-group">
              <button className="tool-button" onClick={() => copyText(document)}>
                <Copy size={16} />
                Copiar JSON
              </button>
              <button className="icon-button">
                <Maximize2 size={16} />
              </button>
            </div>
          </div>
          <div className="tree-canvas">
            {parsed.error ? (
              <EmptyState title="Não foi possível construir a árvore" body={parsed.error} />
            ) : (
              <TreeNode name="root" value={parsed.data} />
            )}
          </div>
          <div className="inspector-card">
            <span className="inspector-label">Visão geral</span>
            <div>
              <strong>{Object.keys(parsed.data ?? {}).length}</strong>
              <span>propriedades raiz</span>
            </div>
            <div>
              <strong>{lineCount(document)}</strong>
              <span>linhas</span>
            </div>
            <div>
              <strong>{bytesLabel(document)}</strong>
              <span>tamanho</span>
            </div>
          </div>
        </div>
      );
    }

    if (module === "compare") {
      return (
        <div className="module-content compare-layout">
          <div className="split-grid">
            <CodeArea
              value={document}
              onChange={setDocument}
              label="Versão atual"
              error={parsed.error}
            />
            <CodeArea
              value={compareDocument}
              onChange={setCompareDocument}
              label="Versão proposta"
              error={comparedParsed.error}
            />
          </div>
          <div className="diff-summary">
            <span className="summary-title">Alterações encontradas</span>
            <span className="diff-chip added">+ {compareStats.added} adicionadas</span>
            <span className="diff-chip removed">− {compareStats.removed} removidas</span>
            <span className="diff-chip modified">~ {compareStats.modified} modificadas</span>
            <button
              className="tool-button push-right"
              onClick={() => exportDocument(compareDocument, "json")}
            >
              <Download size={16} />
              Exportar
            </button>
          </div>
        </div>
      );
    }

    if (module === "converter") {
      return (
        <div className="module-content converter-layout">
          <div className="conversion-bar">
            <div>
              <span className="control-label">FORMATO DE ORIGEM</span>
              <div className="format-badge">
                <Braces size={16} />
                JSON
              </div>
            </div>
            <div className="conversion-arrow">
              <GitCompareArrows size={19} />
            </div>
            <div>
              <span className="control-label">FORMATO DE DESTINO</span>
              <div className="segmented">
                {(["YAML", "XML"] as const).map((item) => (
                  <button
                    key={item}
                    className={formatTarget === item ? "active" : ""}
                    onClick={() => setFormatTarget(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <button
              className="primary-button push-right"
              onClick={() => copyText(conversion, `${formatTarget} copiado.`)}
            >
              <Copy size={16} />
              Copiar resultado
            </button>
          </div>
          <div className="split-grid">
            <CodeArea
              value={document}
              onChange={setDocument}
              label="Entrada JSON"
              error={parsed.error}
            />
            <CodeArea value={conversion} label={`Saída ${formatTarget}`} readOnly />
          </div>
        </div>
      );
    }

    if (module === "search") {
      return (
        <div className="module-content search-layout">
          <div className="search-hero">
            <div className="large-search">
              <Search size={20} />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Busque por uma chave ou valor..."
                autoFocus
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm("")}>
                  <X size={17} />
                </button>
              )}
            </div>
            <div className="segmented">
              {(["ambos", "propriedade", "valor"] as const).map((item) => (
                <button
                  key={item}
                  className={searchMode === item ? "active" : ""}
                  onClick={() => setSearchMode(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="results-heading">
            <span>
              {matches.length} {matches.length === 1 ? "resultado" : "resultados"}
            </span>
            <span className="muted-label">Busca no documento ativo</span>
          </div>
          <div className="results-list">
            {matches.length ? (
              matches.map((match, index) => (
                <button
                  className="result-card"
                  key={`${match.path}-${index}`}
                  onClick={() => copyText(match.path, "Caminho copiado.")}
                >
                  <span className={`type-pill type-${match.type}`}>{match.type.slice(0, 3)}</span>
                  <div>
                    <strong>{match.path}</strong>
                    <span>
                      {match.value.length > 100 ? `${match.value.slice(0, 100)}…` : match.value}
                    </span>
                  </div>
                  <Copy size={15} />
                </button>
              ))
            ) : (
              <EmptyState
                title="Nenhuma correspondência"
                body="Tente outro termo ou altere o modo de pesquisa."
              />
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="module-content schema-layout">
        <div className="schema-status">
          <div
            className={`status-icon ${schemaErrors.length || parsed.error || schemaParsed.error ? "status-fail" : ""}`}
          >
            {schemaErrors.length || parsed.error || schemaParsed.error ? (
              <CircleAlert size={19} />
            ) : (
              <Check size={19} />
            )}
          </div>
          <div>
            <strong>
              {schemaErrors.length || parsed.error || schemaParsed.error
                ? "Validação requer atenção"
                : "Documento válido"}
            </strong>
            <span>
              {parsed.error
                ? "Documento com erro de sintaxe JSON."
                : schemaParsed.error
                  ? "Schema com erro de sintaxe JSON."
                  : schemaErrors.length
                    ? `${schemaErrors.length} erro encontrado`
                    : "O documento atende ao schema draft-07."}
            </span>
          </div>
          {schemaErrors.length > 0 && (
            <button
              className="tool-button"
              onClick={autoFixDocument}
              title="Corrigir tipos automaticamente"
            >
              <WandSparkles size={14} />
              Auto-corrigir
            </button>
          )}
          <span className="draft-badge">DRAFT-07</span>
        </div>
        <div className="split-grid schema-grid">
          <CodeArea value={schema} onChange={setSchema} label="Schema" error={schemaParsed.error} />
          <CodeArea
            value={document}
            onChange={setDocument}
            label="Documento"
            error={parsed.error}
          />
        </div>
        {!!schemaErrors.length && (
          <div className="validation-errors">
            {schemaErrors.map((error) => (
              <div key={error.path}>
                <CircleAlert size={15} />
                <strong>{error.path}</strong>
                <span>{error.message}</span>
                <code>{error.rule}</code>
              </div>
            ))}
            {schemaErrors.some((e) => e.rule === "required") && (
              <div className="required-fields-form">
                <span className="form-label">Preencher campos obrigatórios ausentes:</span>
                {schemaErrors
                  .filter((e) => e.rule === "required")
                  .map((e) => {
                    const key = e.path.replace("$.", "");
                    return (
                      <div key={key} className="required-field-row">
                        <label>{key}</label>
                        <input
                          value={requiredFieldValues[key] ?? ""}
                          onChange={(ev) =>
                            setRequiredFieldValues({
                              ...requiredFieldValues,
                              [key]: ev.target.value,
                            })
                          }
                          placeholder={`Valor para "${key}"`}
                        />
                      </div>
                    );
                  })}
                <button
                  className="primary-button"
                  onClick={fillRequiredFields}
                  disabled={!parsed.data || Object.values(requiredFieldValues).every((v) => !v)}
                >
                  Preencher campos obrigatórios
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const meta = moduleMeta[module];

  return (
    <div className={dark ? "app-shell dark" : "app-shell light"}>
      <aside className={`sidebar ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
        <div className="brand">
          <div className="brand-mark">
            <Braces size={22} />
          </div>
          {sidebarOpen && (
            <div>
              <strong>
                JSON<span>studio</span>
              </strong>
              <small>Developer workspace</small>
            </div>
          )}
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
        </div>
        <div className="workspace-label">
          {sidebarOpen ? "FERRAMENTAS" : <span className="workspace-rule" />}
        </div>
        <nav>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={module === item.id ? "nav-active" : ""}
                onClick={() => setModule(item.id)}
                title={item.label}
              >
                <span className="nav-icon">
                  <Icon size={18} />
                </span>
                {sidebarOpen && (
                  <span className="nav-copy">
                    <strong>{item.label}</strong>
                    <small>{item.hint}</small>
                  </span>
                )}
                {sidebarOpen && module === item.id && <ChevronRight size={15} />}
              </button>
            );
          })}
        </nav>
        <div className="recent-card">
          {sidebarOpen ? (
            <>
              <span>DOCUMENTO ATIVO</span>
              <div>
                <FileJson size={18} />
                <p>
                  <strong>atlas-config.json</strong>
                  <small>{bytesLabel(document)} · agora</small>
                </p>
              </div>
            </>
          ) : (
            <FileJson size={18} />
          )}
        </div>
        <button className="settings-button" title="Configurações" onClick={() => setSettingsOpen(true)}>
          <Settings2 size={18} />
          {sidebarOpen && <span>Preferências</span>}
        </button>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <Menu size={19} />
          </button>
          <div className="breadcrumbs">
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{meta.title}</strong>
          </div>
          <div className="top-actions">
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(e) => importDocument(e.target.files?.[0])}
            />
            <button
              className="top-action"
              onClick={() => {
                setDocument("{}");
                setModule("editor");
              }}
            >
              <FilePlus2 size={17} />
              <span>Novo</span>
            </button>
            <button className="top-action" onClick={() => fileRef.current?.click()}>
              <FolderOpen size={17} />
              <span>Abrir</span>
            </button>
            <button className="top-action" onClick={() => exportDocument()}>
              <Upload size={17} />
              <span>Exportar</span>
            </button>
            <span className="top-divider" />
            <button className="icon-button" onClick={() => setDark(!dark)} title="Alternar tema">
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button className="avatar">JS</button>
          </div>
        </header>

        <section className="page-head">
          <div>
            <span className="eyebrow">{meta.eyebrow}</span>
            <h1>{meta.title}</h1>
            <p>{meta.description}</p>
          </div>
          <div className="head-actions">
            <button className="tool-button" onClick={resetWorkspace}>
              <RotateCcw size={15} />
              Restaurar exemplo
            </button>
            <div className={`validity-badge ${parsed.error ? "invalid" : ""}`}>
              {parsed.error ? <CircleAlert size={14} /> : <Check size={14} />}
              {parsed.error ? "JSON inválido" : "JSON válido"}
            </div>
          </div>
        </section>

        {renderContent()}

        <footer className="statusbar">
          <div>
            <span className={`status-dot ${parsed.error ? "status-dot-error" : ""}`} />
            {parsed.error ? "Sintaxe inválida" : "Pronto"}
          </div>
          <div>
            <span>UTF-8</span>
            <span>{lineCount(document)} linhas</span>
            <span>{bytesLabel(document)}</span>
            <span>Ln 1, Col 1</span>
          </div>
        </footer>
      </main>
      {toast && (
        <div className="toast">
          <Check size={16} />
          {toast}
        </div>
      )}

      {settingsOpen && (
        <div className="modal-overlay" onClick={() => setSettingsOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Preferências</h2>
              <button className="modal-close" onClick={() => setSettingsOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="settings-section">
                <h3>Editor JSON</h3>
                <div className="setting-row">
                  <label>Indentação</label>
                  <div className="indent-select">
                    <button
                      className={indent === 2 ? "active" : ""}
                      onClick={() => setIndent(2)}
                      title="2 espaços"
                    >
                      2
                    </button>
                    <button
                      className={indent === 4 ? "active" : ""}
                      onClick={() => setIndent(4)}
                      title="4 espaços"
                    >
                      4
                    </button>
                    <button
                      className={indent === -1 ? "active" : ""}
                      onClick={() => setIndent(-1)}
                      title="Tab"
                    >
                      Tab
                    </button>
                  </div>
                  <span className="setting-hint">
                    Define a quantidade de espaços ao formatar o documento JSON.
                  </span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="secondary-button" onClick={() => setSettingsOpen(false)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <div>
        <Search size={22} />
      </div>
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  );
}

export default App;
