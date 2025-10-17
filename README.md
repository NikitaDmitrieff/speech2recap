# Speech2Recap

Transform audio recordings into organized summaries with AI-powered transcription and analysis.

A minimalistic, locally-hosted web application that transcribes audio files using OpenAI's Whisper and generates structured summaries with GPT-4o.

## ✨ Features

### Core Functionality
- 🎙️ **High-Quality Transcription**: Uses OpenAI Whisper AI for accurate speech-to-text
- 🌍 **Multi-Language Support**: Transcribe in English or French
- 📝 **AI-Generated Summaries**: Automatic summary and key points extraction
- 📊 **Smart Large File Handling**: Automatically processes files over 25MB
  - **Split Mode**: Divides audio into 2-4 parts for complete transcription
  - **Trim Mode**: Transcribes first X minutes for quick previews

### Advanced Options
- 🎯 **Custom Context**: Provide background info for better AI understanding
- 📏 **Adjustable Summary Length**: From brief (2-3 sentences) to extensive (15+ sentences)
- 🌐 **Multi-Language Output**: Get summaries in 8+ languages
- 🔧 **Customizable Prompts**: Easy-to-edit prompt templates

### User Experience
- ⚫⚪ **Minimalistic Design**: Clean black and white interface
- 🖱️ **Drag & Drop**: Simple file upload with visual feedback
- ⚡ **Fast Processing**: Optimized for speed with progress indicators
- 🏠 **100% Local**: Runs on your machine, OpenAI API only for AI processing

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- OpenAI API key ([Get one here](https://platform.openai.com/api-keys))

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/speech2recap.git
   cd speech2recap
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure OpenAI API Key**:
   
   Create a `.env.local` file in the root directory:
   ```bash
   OPENAI_API_KEY=your_actual_api_key_here
   ```
   
   > Get your API key from: https://platform.openai.com/api-keys

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Open your browser**:
   
   Navigate to [http://localhost:3000](http://localhost:3000)

### Production Build

```bash
npm run build
npm start
```

## 📖 Usage

### Basic Usage

1. **Upload Audio**: Drag and drop an audio file (m4a or mp3) or click to select
2. **Select Language**: Choose transcription language (English or French)
3. **Click Transcribe**: Processing begins automatically
4. **View Results**: Get transcription, summary, and key points

### Large File Handling (>25MB)

When you upload a file larger than 25MB, you'll see two options:

#### 🔀 Split Mode (Recommended)
- Automatically divides audio into 2-4 equal parts
- Each part is transcribed separately
- All transcriptions are combined for a complete result
- Takes longer but provides full transcription

#### ✂️ Trim Mode (Quick Preview)
- Transcribes only the first X minutes
- Use the slider to choose duration (1-24 minutes)
- Faster processing
- Ideal for previewing long recordings

### Advanced Prompting

Click "Advanced Prompting" to customize the AI analysis:

- **Context**: Provide background information for better understanding
  - Example: "Medical lecture on cardiology" or "Q4 planning meeting"
  - Helps AI provide more relevant summaries
  
- **Summary Length**: Adjust detail level with the slider
  - **Brief** (1): 2-3 sentences, 2-3 key points
  - **Moderate** (2): 4-6 sentences, 3-5 key points
  - **Detailed** (3): 7-10 sentences, 5-7 key points
  - **Comprehensive** (4): 10-15 sentences, 7-10 key points
  - **Extensive** (5): 15+ sentences, 10+ key points
  
- **Output Language**: Choose summary language independently from transcription
  - Available: Same as original, English, French, Spanish, German, Italian, Portuguese, Chinese, Japanese

## 🔧 Customizing Prompts

Tailor the AI analysis to your specific needs by editing `lib/prompts.ts`:

```typescript
// lib/prompts.ts
export const SUMMARY_LENGTH_INSTRUCTIONS = {
  brief: 'Provide a very concise summary...',
  moderate: 'Provide a concise summary...',
  // ... customize these instructions
};

export function buildSummaryPrompt(config: PromptConfig): string {
  // Modify this function to change AI behavior
}
```

**What you can customize:**
- Summary length definitions and instructions
- Tone and style (formal, casual, technical, etc.)
- Industry-specific terminology
- Output format preferences
- Key point extraction logic

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 15 with App Router
- **UI**: shadcn/ui components (Button, Card, Select, Slider, Collapsible, Radio Group)
- **Styling**: Tailwind CSS v4
- **File Upload**: react-dropzone
- **Icons**: lucide-react

### Backend
- **API Routes**: Next.js serverless functions
- **Audio Processing**: FFmpeg (via fluent-ffmpeg, ffmpeg-static)
- **Duration Detection**: FFprobe (@ffprobe-installer/ffprobe)
- **AI Services**: 
  - OpenAI Whisper-1 (transcription)
  - OpenAI GPT-4o (summarization with JSON mode)

### Key Features
- Server-side audio splitting for large files
- Dynamic part calculation (2-4 parts based on duration)
- Streaming API responses
- Type-safe with TypeScript

## 📝 How It Works

### For Files Under 25MB
1. Upload → Whisper API → Transcription
2. Transcription + Custom Prompt → GPT-4o → Summary & Key Points

### For Files Over 25MB (Split Mode)
1. Upload → FFprobe (get exact duration)
2. Calculate optimal parts (24 min/part @ 128kbps)
3. FFmpeg splits audio into N equal parts
4. Each part → Whisper API → Partial transcription
5. Combine all transcriptions
6. Full transcription + Prompt → GPT-4o → Summary & Key Points

## ⚠️ Important Notes

- **API Costs**: Uses OpenAI API (Whisper: ~$0.006/min, GPT-4o: ~$0.005/1K tokens)
- **Processing Time**: 
  - Small files (<25MB): 30 seconds - 2 minutes
  - Large files (split mode): 2-5 minutes depending on parts
- **File Size**: Whisper API limit is 25MB per request (handled automatically)
- **Supported Formats**: m4a, mp3 (FFmpeg can process most audio formats)
- **Local Storage**: Temporary files are created and cleaned up automatically

## 🐛 Troubleshooting

### "FFprobe not found" error
- FFprobe is installed automatically via npm
- On some systems, you may need to install FFmpeg manually
- macOS: `brew install ffmpeg`
- Ubuntu: `sudo apt-get install ffmpeg`

### "Invalid API Key" error
- Check that `.env.local` exists and contains your OpenAI API key
- Verify the key is active at https://platform.openai.com/api-keys
- Restart the dev server after adding the key

### Large file processing fails
- Try "Trim Mode" instead of "Split Mode"
- Check that you have sufficient disk space for temporary files
- Verify FFmpeg/FFprobe are properly installed

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs via GitHub Issues
- Submit feature requests
- Open Pull Requests with improvements
- Share your custom prompts

## 📄 License

MIT License - feel free to use this project for personal or commercial purposes.

## 🙏 Acknowledgments

- OpenAI for Whisper and GPT-4o APIs
- shadcn for the beautiful UI components
- Vercel for Next.js framework
