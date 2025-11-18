import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolContext, ToolResponse, ImplementationLogEntry } from '../types.js';
import { PathUtils } from '../core/path-utils.js';
import { ImplementationLogManager } from '../dashboard/implementation-log-manager.js';
import { promises as fs } from 'fs';
import { join } from 'path';

// Response types for query-logs tool
export interface LogQueryMatch {
  specName: string;
  taskId: string;
  timestamp: string;
  isArchived: boolean;
  artifact: {
    type: 'apiEndpoint' | 'component' | 'function' | 'class' | 'integration';
    data: any; // Actual artifact object
  };
  context: {
    summary: string; // Task summary
    filesModified: string[];
    filesCreated: string[];
  };
}

export interface QueryLogsResponse {
  matches: LogQueryMatch[];
  searchTerm: string;
  specsSearched: number;
  logsSearched: number;
}

export const queryLogsTool: Tool = {
  name: 'query-logs',
  description: `Search implementation logs for existing code artifacts.

Query before implementing to find:
- Existing API endpoints
- Implemented components
- Utility functions
- Integration patterns

Prevents duplicate code by discovering what's already built.

Searches artifact names, locations, and task summaries. Case-insensitive substring matching.`,

  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Absolute path to project root (optional - uses context)'
      },
      searchTerm: {
        type: 'string',
        description: 'Search keyword (e.g., "UserService", "/api/users", "hashPassword")'
      },
      specName: {
        type: 'string',
        description: 'Limit search to specific spec (optional - searches all if omitted)'
      },
      artifactType: {
        type: 'string',
        enum: ['apiEndpoints', 'components', 'functions', 'classes', 'integrations', 'all'],
        description: 'Filter by artifact type (optional)'
      }
    },
    required: ['searchTerm']
  }
};

/**
 * Get all spec names (active and optionally archived)
 */
async function getAllSpecNames(projectPath: string, includeArchived: boolean): Promise<Array<{ name: string; isArchived: boolean }>> {
  const specs: Array<{ name: string; isArchived: boolean }> = [];

  // Scan active specs
  const activeSpecsDir = join(PathUtils.getWorkflowRoot(projectPath), 'specs');
  try {
    const activeEntries = await fs.readdir(activeSpecsDir, { withFileTypes: true });
    for (const entry of activeEntries) {
      if (entry.isDirectory()) {
        specs.push({ name: entry.name, isArchived: false });
      }
    }
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
    // Directory doesn't exist, continue
  }

  // Scan archived specs if requested
  if (includeArchived) {
    const archivedSpecsDir = PathUtils.getArchiveSpecsPath(projectPath);
    try {
      const archivedEntries = await fs.readdir(archivedSpecsDir, { withFileTypes: true });
      for (const entry of archivedEntries) {
        if (entry.isDirectory()) {
          specs.push({ name: entry.name, isArchived: true });
        }
      }
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      // Directory doesn't exist, continue
    }
  }

  return specs;
}

/**
 * Search artifacts in a log entry for matches
 */
function searchArtifacts(
  entry: ImplementationLogEntry,
  searchTerm: string,
  artifactTypeFilter?: string
): Array<{ type: string; data: any }> {
  const matches: Array<{ type: string; data: any }> = [];
  const lowerSearchTerm = searchTerm.toLowerCase();

  if (!entry.artifacts) return matches;

  // Helper function to check if a value matches the search term
  const matchesSearch = (value: any): boolean => {
    if (typeof value === 'string') {
      return value.toLowerCase().includes(lowerSearchTerm);
    }
    if (Array.isArray(value)) {
      return value.some(v => matchesSearch(v));
    }
    return false;
  };

  // Helper function to check if an artifact matches
  const artifactMatches = (artifact: any): boolean => {
    return Object.values(artifact).some(value => matchesSearch(value));
  };

  // Search API endpoints
  if ((!artifactTypeFilter || artifactTypeFilter === 'all' || artifactTypeFilter === 'apiEndpoints') && entry.artifacts.apiEndpoints) {
    for (const endpoint of entry.artifacts.apiEndpoints) {
      if (artifactMatches(endpoint)) {
        matches.push({ type: 'apiEndpoint', data: endpoint });
      }
    }
  }

  // Search components
  if ((!artifactTypeFilter || artifactTypeFilter === 'all' || artifactTypeFilter === 'components') && entry.artifacts.components) {
    for (const component of entry.artifacts.components) {
      if (artifactMatches(component)) {
        matches.push({ type: 'component', data: component });
      }
    }
  }

  // Search functions
  if ((!artifactTypeFilter || artifactTypeFilter === 'all' || artifactTypeFilter === 'functions') && entry.artifacts.functions) {
    for (const func of entry.artifacts.functions) {
      if (artifactMatches(func)) {
        matches.push({ type: 'function', data: func });
      }
    }
  }

  // Search classes
  if ((!artifactTypeFilter || artifactTypeFilter === 'all' || artifactTypeFilter === 'classes') && entry.artifacts.classes) {
    for (const cls of entry.artifacts.classes) {
      if (artifactMatches(cls)) {
        matches.push({ type: 'class', data: cls });
      }
    }
  }

  // Search integrations
  if ((!artifactTypeFilter || artifactTypeFilter === 'all' || artifactTypeFilter === 'integrations') && entry.artifacts.integrations) {
    for (const integration of entry.artifacts.integrations) {
      if (artifactMatches(integration)) {
        matches.push({ type: 'integration', data: integration });
      }
    }
  }

  return matches;
}

export async function queryLogsHandler(args: any, context: ToolContext): Promise<ToolResponse> {
  const projectPath = args.projectPath || context.projectPath;
  const { searchTerm, specName, artifactType } = args;

  if (!searchTerm || typeof searchTerm !== 'string' || searchTerm.trim().length === 0) {
    return {
      success: false,
      message: 'Search term is required and must be non-empty',
      nextSteps: ['Provide a search term (e.g., "UserService", "/api/auth", "validateToken")']
    };
  }

  try {
    // Determine which specs to search
    let specsToSearch: Array<{ name: string; isArchived: boolean }>;

    if (specName) {
      // Search only the specified spec
      // Check if it's active or archived
      const activeSpecPath = PathUtils.getSpecPath(projectPath, specName);
      const archivedSpecPath = PathUtils.getArchiveSpecPath(projectPath, specName);

      let isArchived = false;
      let specPath = activeSpecPath;

      try {
        await fs.access(activeSpecPath);
      } catch {
        // Not in active, check archive
        try {
          await fs.access(archivedSpecPath);
          isArchived = true;
          specPath = archivedSpecPath;
        } catch {
          return {
            success: false,
            message: `Spec not found: ${specName}`,
            nextSteps: ['Use list-specs to see available specs', 'Check spec name spelling']
          };
        }
      }

      specsToSearch = [{ name: specName, isArchived }];
    } else {
      // Search all specs (active + archived)
      specsToSearch = await getAllSpecNames(projectPath, true);
    }

    const allMatches: LogQueryMatch[] = [];
    let logsSearchedCount = 0;

    for (const spec of specsToSearch) {
      const specPath = spec.isArchived
        ? PathUtils.getArchiveSpecPath(projectPath, spec.name)
        : PathUtils.getSpecPath(projectPath, spec.name);

      const logManager = new ImplementationLogManager(specPath);

      try {
        const logs = await logManager.getAllLogs();
        logsSearchedCount += logs.length;

        for (const log of logs) {
          // Search in task summary first
          const summaryMatch = log.summary.toLowerCase().includes(searchTerm.toLowerCase());

          // Search in artifacts
          const artifactMatches = searchArtifacts(log, searchTerm, artifactType);

          // If either summary or artifacts match, include results
          if (summaryMatch || artifactMatches.length > 0) {
            // For summary matches, we still want to show relevant artifacts if any
            if (artifactMatches.length > 0) {
              for (const artifact of artifactMatches) {
                allMatches.push({
                  specName: spec.name,
                  taskId: log.taskId,
                  timestamp: log.timestamp,
                  isArchived: spec.isArchived,
                  artifact: artifact as any,
                  context: {
                    summary: log.summary,
                    filesModified: log.filesModified,
                    filesCreated: log.filesCreated
                  }
                });
              }
            } else if (summaryMatch) {
              // Summary matches but no artifacts - create a match without artifact details
              allMatches.push({
                specName: spec.name,
                taskId: log.taskId,
                timestamp: log.timestamp,
                isArchived: spec.isArchived,
                artifact: {
                  type: 'function' as any, // Placeholder
                  data: { summary: log.summary }
                },
                context: {
                  summary: log.summary,
                  filesModified: log.filesModified,
                  filesCreated: log.filesCreated
                }
              });
            }
          }
        }
      } catch (error) {
        // Skip specs where we can't read logs
        continue;
      }
    }

    // Limit to 100 matches
    const limitedMatches = allMatches.slice(0, 100);

    const response: QueryLogsResponse = {
      matches: limitedMatches,
      searchTerm,
      specsSearched: specsToSearch.length,
      logsSearched: logsSearchedCount
    };

    const message = limitedMatches.length === 0
      ? `No matches found for "${searchTerm}"`
      : limitedMatches.length < allMatches.length
        ? `Found ${limitedMatches.length} match(es) (limited from ${allMatches.length} total)`
        : `Found ${limitedMatches.length} match(es)`;

    return {
      success: true,
      message,
      data: response
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to query logs: ${errorMessage}`,
      nextSteps: [
        'Check that project path is valid',
        'Ensure .spec-workflow directory exists',
        'Verify filesystem permissions'
      ]
    };
  }
}
