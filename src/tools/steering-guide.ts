import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolContext, ToolResponse } from '../types.js';

export const steeringGuideTool: Tool = {
  name: 'steering-guide',
  description: `Load steering document guide. Call when user requests project architecture docs (product.md, tech.md, structure.md). Returns resource URI - read with ReadMcpResourceTool.`,
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false
  }
};

export async function steeringGuideHandler(args: any, context: ToolContext): Promise<ToolResponse> {
  return {
    success: true,
    message: 'Steering workflow guide available as resource - read it NOW before proceeding',
    data: {
      resourceUri: 'spec-workflow://steering-guide',
      instruction: 'Read this resource NOW with ReadMcpResourceTool before proceeding',
      quickSummary: 'Create product.md, tech.md, structure.md steering documents',
      dashboardUrl: context.dashboardUrl
    },
    nextSteps: [
      'CRITICAL: Call ReadMcpResourceTool with uri: spec-workflow://steering-guide',
      'Read the complete steering workflow guide from the resource',
      'Only proceed if user explicitly requested steering docs',
      'Create product.md → tech.md → structure.md',
      context.dashboardUrl ? `Dashboard: ${context.dashboardUrl}` : 'Start the dashboard with: spec-workflow-mcp --dashboard'
    ]
  };
}