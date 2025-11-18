import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  Resource,
  ResourceContents
} from '@modelcontextprotocol/sdk/types.js';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * Register MCP resource handlers with the server
 */
export function registerResourceHandlers(server: Server): void {
  server.setRequestHandler(ListResourcesRequestSchema, handleListResources);
  server.setRequestHandler(ReadResourceRequestSchema, handleReadResource);
}

/**
 * Handle resources/list request
 * Returns all available workflow documentation resources
 */
async function handleListResources(): Promise<{ resources: Resource[] }> {
  return {
    resources: [
      {
        uri: 'spec-workflow://guide',
        name: 'Spec Workflow Guide',
        description: 'Complete workflow sequence: Requirements → Design → Tasks → Implementation',
        mimeType: 'text/markdown'
      },
      {
        uri: 'spec-workflow://steering-guide',
        name: 'Steering Document Guide',
        description: 'Guide for creating project steering documents (product.md, tech.md, structure.md)',
        mimeType: 'text/markdown'
      },
      {
        uri: 'spec-workflow://approval-workflow',
        name: 'Approval Workflow Pattern',
        description: 'Standard approval sequence: request → poll status → delete',
        mimeType: 'text/markdown'
      }
    ]
  };
}

/**
 * Handle resources/read request
 * Returns markdown content for the requested resource URI
 */
async function handleReadResource(request: { params: { uri: string } }): Promise<{ contents: ResourceContents[] }> {
  const { uri } = request.params;

  let content: string;

  try {
    content = await readResourceContent(uri);
  } catch (error: any) {
    // Return error as resource content for graceful handling
    return {
      contents: [{
        uri,
        mimeType: 'text/plain',
        text: `Error reading resource: ${error.message}\n\nThis resource may not be available. Please check the resource URI.`
      }]
    };
  }

  return {
    contents: [{
      uri,
      mimeType: 'text/markdown',
      text: content
    }]
  };
}

/**
 * Read resource content from markdown file based on URI
 */
async function readResourceContent(uri: string): Promise<string> {
  const __dirname = dirname(fileURLToPath(import.meta.url));

  // Map URIs to markdown files
  const resourceMap: Record<string, string> = {
    'spec-workflow://guide': join(__dirname, 'workflow-guide.md'),
    'spec-workflow://steering-guide': join(__dirname, 'steering-guide.md'),
    'spec-workflow://approval-workflow': join(__dirname, 'approval-workflow.md')
  };

  const filePath = resourceMap[uri];

  if (!filePath) {
    throw new Error(`Unknown resource URI: ${uri}`);
  }

  try {
    return await readFile(filePath, 'utf-8');
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`Resource file not found: ${filePath}`);
    }
    throw error;
  }
}
