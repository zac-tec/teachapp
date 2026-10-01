export const stages = [
  {
    name: "Python & SQL refresh",
    aim: "Make familiar ideas usable independently.",
    topics: [
      "Variables and data types",
      "Comparisons and conditions",
      "Lists and dictionaries",
      "Loops and accumulators",
      "Functions and return values",
      "Reading errors and debugging",
      "SELECT, WHERE and ORDER BY",
      "SQL aggregates and GROUP BY",
      "Basic joins",
      "Expense summary mini-project",
    ],
  },
  {
    name: "Spreadsheets & data basics",
    aim: "Understand a dataset before analyzing it.",
    topics: [
      "Rows, columns and data types",
      "Percentages and percentage change",
      "Formulas and cell references",
      "Lookups and conditional formulas",
      "Missing values and duplicates",
      "Pivot tables and charts",
    ],
  },
  {
    name: "Python for analysis",
    aim: "Clean, combine and explore real datasets.",
    topics: [
      "Notebooks and CSV files",
      "NumPy arrays and calculations",
      "pandas selection and filtering",
      "Cleaning and validating data",
      "Grouping and aggregation",
      "Merging tables",
      "Dates and time series basics",
      "Reproducible analysis notebook",
    ],
  },
  {
    name: "Practical SQL",
    aim: "Answer questions across related tables.",
    topics: [
      "Keys and table relationships",
      "INNER and LEFT JOIN",
      "CASE and NULL handling",
      "Dates and text functions",
      "Subqueries and CTEs",
      "Window functions",
      "Checking join counts and totals",
    ],
  },
  {
    name: "Maths & statistics",
    aim: "Interpret results with care.",
    topics: [
      "Ratios and basic algebra",
      "Mean, median and percentiles",
      "Variance and standard deviation",
      "Probability and distributions",
      "Sampling and bias",
      "Confidence intervals",
      "Hypothesis tests",
      "Correlation and causation",
    ],
  },
  {
    name: "Exploration & storytelling",
    aim: "Turn analysis into a clear explanation.",
    topics: [
      "Framing a useful question",
      "Distributions and outliers",
      "Comparing groups and trends",
      "Choosing honest charts",
      "Writing findings and limitations",
      "Presenting an analysis",
    ],
  },
  {
    name: "Dashboards",
    aim: "Create a report someone can use.",
    topics: [
      "Power BI or Tableau foundations",
      "Data transformation",
      "Relationships and data models",
      "Measures and calculations",
      "Filters and interactions",
      "Dashboard layout and validation",
    ],
  },
  {
    name: "Business analysis",
    aim: "Connect numbers to decisions.",
    topics: [
      "Revenue, costs and profit",
      "Margins and growth",
      "Conversion and funnels",
      "Retention and cohorts",
      "Stakeholder questions",
      "Business case study",
    ],
  },
  {
    name: "Portfolio & work readiness",
    aim: "Show and explain independent work.",
    topics: [
      "Git and GitHub basics",
      "Project documentation",
      "Data privacy and attribution",
      "Three polished portfolio projects",
      "SQL interview practice",
      "Analytical case interviews",
      "Resume and project presentation",
    ],
  },
  {
    name: "Financial analytics",
    aim: "Apply data skills to historical financial questions.",
    topics: [
      "Financial statements",
      "Compounding and present value",
      "Assets and benchmarks",
      "Prices versus returns",
      "Adjusted data and trading dates",
      "Volatility and drawdowns",
      "Diversification and covariance",
      "Historical financial analysis project",
    ],
  },
  {
    name: "Optional quantitative finance",
    aim: "Explore this specialization after the foundations.",
    topics: [
      "Linear algebra",
      "Calculus and optimization",
      "Regression and time series",
      "Simulation methods",
      "Portfolio theory",
      "Backtesting and transaction costs",
      "Leakage and overfitting",
      "Derivatives and stochastic processes",
    ],
  },
];
export const topics = stages.flatMap((s, i) =>
  s.topics.map((title, j) => ({ id: `${i + 1}-${j + 1}`, title, stage: i })),
);
export const levels = [
  "Not assessed",
  "Introduced",
  "With support",
  "Independent",
  "Transfer",
];
export type RecordItem = {
  id: string;
  kind: string;
  payload: any;
  revision: number;
  updated: string;
};
