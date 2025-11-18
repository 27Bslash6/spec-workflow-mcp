import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolContext, ToolResponse, ImplementationLogEntry } from '../types.js';
import { PathUtils } from '../core/path-utils.js';
import { ImplementationLogManager } from '../dashboard/implementation-log-manager.js';
import { parseTasksFromMarkdown } from '../core/task-parser.js';

export const logImplementationTool: Tool = {
  name: 'log-implementation',
  description: `Record comprehensive implementation details for a completed task.

⚠️ CRITICAL: Artifacts are REQUIRED. This creates a searchable knowledge base that future AI agents use to discover existing code and avoid duplication.

Future agents grep implementation logs before implementing new tasks. Complete logs prevent duplicating APIs, components, functions, and integrations.

# REQUIRED: artifacts object

Document ALL implemented artifacts with full details:

## apiEndpoints (array)
For new/modified API endpoints:
- method, path, purpose, requestFormat, responseFormat, location (file:line)

Example: \`{ "method": "GET", "path": "/api/users", "purpose": "List users", "location": "server.ts:45" }\`

## components (array)
For reusable UI components:
- name, type (React/Vue/etc), purpose, location, props, exports

Example: \`{ "name": "UserList", "type": "React", "purpose": "Display users", "location": "components/UserList.tsx" }\`

## functions (array)
For utility functions:
- name, purpose, location, signature, isExported

Example: \`{ "name": "hashPassword", "purpose": "Hash user passwords", "location": "utils/auth.ts:12", "signature": "(password: string) => string", "isExported": true }\`

## classes (array)
For classes:
- name, purpose, location, methods[], isExported

Example: \`{ "name": "UserService", "purpose": "User CRUD operations", "location": "services/user.ts", "methods": ["create", "update", "delete"] }\`

## integrations (array)
For frontend-backend connections:
- description, frontendComponent, backendEndpoint, dataFlow

Example: \`{ "description": "User list page fetches from API", "frontendComponent": "UserList", "backendEndpoint": "GET /api/users", "dataFlow": "Mount → API fetch → Display" }\`

# Good vs Bad

✅ GOOD: \`{ "artifacts": { "apiEndpoints": [...], "components": [...] }, "filesModified": [...] }\`
❌ BAD: \`{ "artifacts": {}, "summary": "did stuff" }\`

Be thorough - future agents depend on this data quality.`,
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Absolute path to the project root (optional - uses server context path if not provided)'
      },
      specName: {
        type: 'string',
        description: 'Name of the specification'
      },
      taskId: {
        type: 'string',
        description: 'Task ID (e.g., "1", "1.2", "3.1.4")'
      },
      summary: {
        type: 'string',
        description: 'Brief summary of what was implemented'
      },
      filesModified: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of files that were modified'
      },
      filesCreated: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of files that were created'
      },
      statistics: {
        type: 'object',
        properties: {
          linesAdded: {
            type: 'number',
            description: 'Number of lines added'
          },
          linesRemoved: {
            type: 'number',
            description: 'Number of lines removed'
          }
        },
        required: ['linesAdded', 'linesRemoved'],
        description: 'Code statistics for the implementation'
      },
      artifacts: {
        type: 'object',
        description: 'REQUIRED: Structured data about implemented artifacts (APIs, components, functions, classes, integrations). See tool description for detailed format.',
        properties: {
          apiEndpoints: {
            type: 'array',
            description: 'API endpoints created or modified',
            items: { type: 'object' }
          },
          components: {
            type: 'array',
            description: 'Reusable UI components created',
            items: { type: 'object' }
          },
          functions: {
            type: 'array',
            description: 'Utility functions or methods created',
            items: { type: 'object' }
          },
          classes: {
            type: 'array',
            description: 'Classes created',
            items: { type: 'object' }
          },
          integrations: {
            type: 'array',
            description: 'Frontend-backend integration patterns',
            items: { type: 'object' }
          }
        }
      }
    },
    required: ['specName', 'taskId', 'summary', 'filesModified', 'filesCreated', 'statistics', 'artifacts']
  }
};

export async function logImplementationHandler(
  args: any,
  context: ToolContext
): Promise<ToolResponse> {
  const {
    specName,
    taskId,
    summary,
    filesModified = [],
    filesCreated = [],
    statistics,
    artifacts
  } = args;
  
  // Use context projectPath as default, allow override via args
  const projectPath = args.projectPath || context.projectPath;
  
  if (!projectPath) {
    return {
      success: false,
      message: 'Project path is required but not provided in context or arguments'
    };
  }

  try {
    // Validate artifacts is provided
    if (!artifacts) {
      return {
        success: false,
        message: 'Artifacts field is REQUIRED. See tool description for detailed artifact format and examples.',
        nextSteps: [
          'Review the log-implementation tool description for artifact structure',
          'Document all API endpoints, components, functions, classes, and integrations',
          'Provide structured artifact data before calling this tool',
          'Ensure artifacts contains at least one of: apiEndpoints, components, functions, classes, or integrations'
        ]
      };
    }

    // Validate task exists
    const specTasksPath = PathUtils.getSpecPath(projectPath, specName);
    const tasksFile = `${specTasksPath}/tasks.md`;

    try {
      const { promises: fs } = await import('fs');
      const tasksContent = await fs.readFile(tasksFile, 'utf-8');
      const parseResult = parseTasksFromMarkdown(tasksContent);
      const taskExists = parseResult.tasks.some(t => t.id === taskId);

      if (!taskExists) {
        return {
          success: false,
          message: `Task '${taskId}' not found in specification '${specName}'`,
          nextSteps: [
            `Check the task ID in .spec-workflow/specs/${specName}/tasks.md`,
            'Verify the spec name is correct',
            'Use spec-status to see available tasks'
          ]
        };
      }
    } catch (parseError) {
      return {
        success: false,
        message: `Failed to validate task: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        nextSteps: [
          `Check that .spec-workflow/specs/${specName}/tasks.md exists`,
          'Verify the tasks file is valid markdown',
          'Use spec-status to diagnose issues'
        ]
      };
    }

    // Create log entry
    const logManager = new ImplementationLogManager(specTasksPath);

    const logEntry: Omit<ImplementationLogEntry, 'id'> = {
      taskId,
      timestamp: new Date().toISOString(),
      summary,
      filesModified: filesModified || [],
      filesCreated: filesCreated || [],
      statistics: {
        linesAdded: statistics.linesAdded || 0,
        linesRemoved: statistics.linesRemoved || 0,
        filesChanged: (filesModified?.length || 0) + (filesCreated?.length || 0)
      },
      artifacts
    };

    const createdEntry = await logManager.addLogEntry(logEntry);

    // Get task stats
    const taskStats = await logManager.getTaskStats(taskId);

    return {
      success: true,
      message: `Implementation logged for task '${taskId}'`,
      data: {
        entryId: createdEntry.id,
        entry: createdEntry,
        taskStats,
        dashboardUrl: `${context.dashboardUrl}/logs?spec=${encodeURIComponent(specName)}&task=${taskId}`
      },
      nextSteps: [
        'Mark task as completed in tasks.md by changing [-] to [x]',
        'View implementation log in dashboard under Logs tab',
        'Continue with next pending task'
      ],
      projectContext: {
        projectPath,
        workflowRoot: PathUtils.getWorkflowRoot(projectPath),
        specName,
        dashboardUrl: context.dashboardUrl
      }
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to log implementation: ${errorMessage}`,
      nextSteps: [
        'Verify all required parameters are provided',
        'Check that the spec and task exist',
        'View dashboard logs to see previous entries'
      ]
    };
  }
}
