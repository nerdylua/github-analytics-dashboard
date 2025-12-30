# GitHub Analytics Dashboard

An analytics dashboard that visualizes GitHub user data with a premium aesthetic. Built with Next.js 15.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS v4
- **Animations**: Framer Motion
- **Charts**: Recharts
- **Icons**: Lucide React
- **API**: GitHub GraphQL API (via Next.js API Routes)

## Getting Started

### Prerequisites
- Node.js 18+
- GitHub Personal Access Token (PAT) with `read:user` and `repo` scopes

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/nerdylua/github-analytics-dashboard.git
   cd github-analytics-dashboard
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env.local
   ```
   Then edit `.env.local` and add your GitHub token.

4. Run the development server:
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## Production Build

```bash
npm run build
npm start
```