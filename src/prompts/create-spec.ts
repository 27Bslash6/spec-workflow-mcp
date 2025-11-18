import { Prompt, PromptMessage } from '@modelcontextprotocol/sdk/types.js';
import { PromptDefinition } from './types.js';
import { ToolContext } from '../types.js';

const prompt: Prompt = {
  name: 'create-spec',
  title: 'Create Specification Document',
  description: 'Guide for creating spec documents directly in the file system. Shows how to use templates and create requirements, design, or tasks documents at the correct paths.',
  arguments: [
    {
      name: 'specName',
      description: 'Feature name in kebab-case (e.g., user-authentication, data-export)',
      required: true
    },
    {
      name: 'documentType', 
      description: 'Type of document to create: requirements, design, or tasks',
      required: true
    },
    {
      name: 'description',
      description: 'Brief description of what this spec should accomplish',
      required: false
    }
  ]
};

async function handler(args: Record<string, any>, context: ToolContext): Promise<PromptMessage[]> {
  const { specName, documentType, description } = args;
  
  if (!specName || !documentType) {
    throw new Error('specName and documentType are required arguments');
  }

  const validDocTypes = ['requirements', 'design', 'tasks'];
  if (!validDocTypes.includes(documentType)) {
    throw new Error(`documentType must be one of: ${validDocTypes.join(', ')}`);
  }

  // Build context-aware messages
  const messages: PromptMessage[] = [
    {
      role: 'user',
      content: {
        type: 'text',
        text: `Create a ${documentType} document for the "${specName}" feature using the spec-workflow methodology.

**Context:**
- Project: ${context.projectPath}
- Feature: ${specName}
- Document type: ${documentType}
${description ? `- Description: ${description}` : ''}
${context.dashboardUrl ? `- Dashboard: ${context.dashboardUrl}` : ''}

**Instructions:**
1. **CRITICAL: Check for custom template FIRST at: .spec-workflow/user-templates/${documentType}-template.md**
2. If custom template exists, read it and use it for document creation
3. If NO custom template exists, read default template at: .spec-workflow/templates/${documentType}-template.md
4. Follow the template structure exactly - this ensures consistency across the project
5. Create comprehensive content that follows spec-driven development best practices
6. Include all required sections from the template
7. Use clear, actionable language
8. Create the document at: .spec-workflow/specs/${specName}/${documentType}.md
9. After creating, use approvals tool with action:'request' to get user approval

**File Paths:**
- **Custom template location (CHECK FIRST):** .spec-workflow/user-templates/${documentType}-template.md
- Default template location (fallback): .spec-workflow/templates/${documentType}-template.md
- Document destination: .spec-workflow/specs/${specName}/${documentType}.md

**Template Priority:**
Custom user templates in user-templates/ directory ALWAYS take precedence over default templates.
This allows projects to customize their spec workflow without modifying core templates.

**Workflow Guidelines:**
- Requirements documents define WHAT needs to be built
- Design documents define HOW it will be built  
- Tasks documents break down implementation into actionable steps
- Each document builds upon the previous one in sequence
- Templates are automatically updated on server start

${documentType === 'tasks' ? `
**Special Instructions for Tasks Document:**
- For each task, generate a _Prompt field with structured AI guidance
- Format: _Prompt: Role: [role] | Task: [description] | Restrictions: [constraints] | Success: [criteria]
- Make prompts specific to the project context and requirements
- Include _Leverage fields pointing to existing code to reuse
- Include _Requirements fields showing which requirements each task implements
- Tasks should be atomic (1-3 files each) and in logical order

**Implementation Logging:**
- When implementing tasks, developers will use the log-implementation tool to record what was done
- Implementation logs appear in the dashboard's "Logs" tab for easy reference
- These logs prevent implementation details from being lost in chat history
- Good task descriptions help developers write better implementation summaries
` : ''}

Please read the ${documentType} template and create the comprehensive document at the specified path.`
      }
    }
  ];

  return messages;
}

export const createSpecPrompt: PromptDefinition = {
  prompt,
  handler
};