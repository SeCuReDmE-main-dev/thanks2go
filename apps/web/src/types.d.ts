interface WebMcpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute(input: Record<string, unknown>): unknown | Promise<unknown>;
}

interface ModelContext {
  registerTool(tool: WebMcpTool, options?: { signal?: AbortSignal }): Promise<void>;
}

interface Document { modelContext?: ModelContext }
