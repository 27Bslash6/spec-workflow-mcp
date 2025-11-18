import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolContext, ToolResponse } from '../types.js';

export const specWorkflowGuideTool: Tool = {
  name: 'spec-workflow-guide',
  description: `Load spec workflow guide. Call FIRST when user requests spec creation or feature development. Returns resource URI - read with ReadMcpResourceTool.`,
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false
  }
};

export async function specWorkflowGuideHandler(args: any, context: ToolContext): Promise<ToolResponse> {
  const dashboardMessage = context.dashboardUrl ?
    `Monitor progress on dashboard: ${context.dashboardUrl}` :
    'Please start the dashboard with: spec-workflow-mcp --dashboard';

  return {
    success: true,
    message: 'Workflow guide available as resource - read it NOW before proceeding',
    data: {
      resourceUri: 'spec-workflow://guide',
      instruction: 'Read this resource NOW with ReadMcpResourceTool before proceeding',
      quickSummary: 'Requirements → Design → Tasks → Implementation workflow',
      dashboardUrl: context.dashboardUrl,
      dashboardAvailable: !!context.dashboardUrl
    },
    nextSteps: [
      'CRITICAL: Call ReadMcpResourceTool with uri: spec-workflow://guide',
      'Read the complete workflow guide from the resource',
      'Follow sequence: Requirements → Design → Tasks → Implementation',
      'Request approval after each document',
      dashboardMessage
    ]
  };
}