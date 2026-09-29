const express = require('express');
const rateLimit = require('express-rate-limit');
const officegen = require('officegen');
const { AzureOpenAI } = require('openai');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Azure OpenAI — all config comes from env vars (see .env.example)
const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4.1-mini';
const azureopenai = new AzureOpenAI({
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview',
  deployment,
  maxRetries: 3
});

// Render sits behind a proxy; needed so the rate limiter sees real client IPs
app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));
app.use(express.static('public'));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_PER_15MIN || 20),
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

const generateCombinedPrompt = () => `
YOU ARE:
- A world-class Chief Product Officer with razor-sharp strategic insights
- A top-tier communications strategist and product marketing expert

CORE MANDATE:
Generate a comprehensive product specification that goes beyond traditional PRDs. Your output must be a strategic blueprint that:
- Tells a compelling product narrative
- Provides actionable, data-driven insights
- Anticipates challenges before they emerge
- Excites both technical and non-technical stakeholders

MANDATORY SPEC SECTIONS (NON-NEGOTIABLE):
1. 🎯 PROBLEM STATEMENT & MARKET CONTEXT
   - Articulate the precise user pain point
   - Quantify the problem with market research data, customer feedback, and impact estimates
   - Explain why solving this problem is urgent

2. 👥 DETAILED USER PERSONAS
   - Include at least 2-3 distinct personas with demographics, professional context, jobs-to-be-done, current workarounds, and emotional journeys

3. 🔍 COMPETITIVE LANDSCAPE ANALYSIS (for the product idea)
   - Provide a detailed table listing:
     * Competitor name (actual companies)
     * Their main product related to this space
     * Key differentiators and approach
     * Pricing (if available)
     * Target audience
   - Clearly indicate what makes each competitor unique

4. 📋 PRODUCT REQUIREMENTS MATRIX
   - List and prioritize requirements with description, priority, estimated effort, user impact, and technical complexity

5. 📊 METRICS & SUCCESS INDICATORS
   - Define primary and guard rail metrics, including specific, measurable OKRs

6. 🚨 RISK & MITIGATION STRATEGY
   - Identify potential risks, failure modes, and corresponding mitigation plans

7. 🚀 GO-TO-MARKET BLUEPRINT
   - Outline rollout strategy, customer adoption plan, and sales/marketing alignment

8. 💻 TECHNICAL DEEP DIVE
   - Provide an overview of system architecture, API/integration considerations, performance, and scalability

9. 💰 INVESTMENT & EFFORT ESTIMATION
   - Estimate development effort, infrastructure costs, and potential ROI

ADDITIONAL EXPECTATIONS:
- Predict potential pivots and challenge assumptions
- Write in clear, professional markdown with visual hierarchy (use emojis where indicated)
- Ensure the output is publication-ready and actionable

---
After the product specification, please generate the following additional sections:

## 🔍 COMPETITIVE LANDSCAPE ANALYSIS
Based on the product idea provided, identify potential competitors. Include a detailed table with:
- At least 5-7 specific company names (no placeholders)
- Their main product related to the space
- Key differentiators and approach
- Pricing (if available)
- Target audience

## 📣 COMMUNICATION ARTIFACTS
Generate three distinct pieces of communication for the product idea:

1. **LinkedIn Post** (250-280 words):
   - Engaging, provocative opening
   - Professional yet exciting language
   - Highlights key user benefits, potential impact, and innovation
   - Includes 2-3 strategic hashtags and ends with a call to action

2. **Blog Post** (1000+ words):
   - Compelling headline and executive summary
   - Detailed problem statement, solution overview, feature breakdown, customer stories, market positioning, technical innovation, timeline, and a call to action

3. **Internal Communication** (Slack/Viva Engage style, 300-400 words):
   - Energetic, team-rallying language
   - Outlines strategic importance, recognizes key stakeholders, details next steps, timeline, feedback areas, and available resources

FINAL INSTRUCTION:
Using the product idea provided by the user, produce a single, combined output that includes the product specification, competitive landscape analysis, and communication artifacts as described above.
`;

app.post('/api/generate-spec', apiLimiter, async (req, res) => {
  const { input } = req.body || {};
  if (!input || input.trim().length < 10) {
    return res.status(400).json({ error: 'Product description too short. Provide more details.' });
  }
  if (input.length > 20000) {
    return res.status(400).json({ error: 'Product description too long. Keep it under 20,000 characters.' });
  }
  try {
    const completion = await azureopenai.chat.completions.create({
      model: deployment,
      messages: [
        { role: 'system', content: generateCombinedPrompt() },
        { role: 'user', content: `Product Idea: ${input}` }
      ],
      temperature: 0.75,
      max_tokens: 8000
    });
    res.json({ spec: completion.choices[0].message.content });
  } catch (error) {
    console.error('Azure OpenAI error:', error);
    res.status(500).json({
      error: 'Error generating spec',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.post('/api/download-spec', (req, res) => {
  const { spec } = req.body || {};
  if (!spec) {
    return res.status(400).json({ error: 'No spec data provided.' });
  }
  try {
    const docx = officegen('docx');

    // Add title and timestamp
    const titleParagraph = docx.createP();
    titleParagraph.addText('Product Specification Document', {
      font_face: 'Arial',
      font_size: 16,
      bold: true
    });
    const dateParagraph = docx.createP();
    dateParagraph.addText(`Generated: ${new Date().toLocaleString()}`, {
      font_face: 'Arial',
      font_size: 10,
      italic: true
    });
    const separatorParagraph = docx.createP();
    separatorParagraph.addText('─'.repeat(50), { font_size: 11 });

    // Process content by line
    const lines = spec.split('\n');
    let currentParagraph = docx.createP();
    for (const line of lines) {
      if (line.startsWith('#') || line.startsWith('- ')) {
        currentParagraph = docx.createP();
        if (line.startsWith('##')) {
          currentParagraph.addText(line.replace(/^##\s*/, ''), {
            font_face: 'Arial',
            font_size: 14,
            bold: true
          });
        } else if (line.startsWith('#')) {
          currentParagraph.addText(line.replace(/^#\s*/, ''), {
            font_face: 'Arial',
            font_size: 16,
            bold: true
          });
        } else {
          currentParagraph.addText(line, { font_face: 'Arial', font_size: 11 });
        }
      } else if (line.trim() === '') {
        currentParagraph = docx.createP();
      } else {
        currentParagraph.addText(line, { font_face: 'Arial', font_size: 11 });
        currentParagraph = docx.createP();
      }
    }

    res.setHeader('Content-Disposition', `attachment; filename=SpecBar_Spec_${Date.now()}.docx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    docx.generate(res);
  } catch (error) {
    console.error('Document generation error:', error);
    res.status(500).json({ error: 'Could not generate document', details: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`SpecBar running on port ${port} (deployment: ${deployment})`);
});
