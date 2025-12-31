/**
 * Query Optimizer Utilities
 * 
 * Provides tools for query analysis, optimization hints, and performance monitoring.
 * 
 * @example
 * ```typescript
 * // Log slow query
 * await logSlowQuery({
 *   queryText: 'SELECT * FROM orders WHERE event_id = $1',
 *   durationMs: 150,
 *   source: 'orders-service',
 * });
 * 
 * // Use optimized query builder
 * const builder = new OptimizedQueryBuilder(supabase)
 *   .from('ticket_types')
 *   .selectWithCovering(['name', 'price', 'total_inventory'])
 *   .withTimeout(5000);
 * ```
 */

import { supabase } from './supabase';
import { createLogger } from './logger';

const logger = createLogger({ module: 'query-optimizer' });

// ============================================
// TYPES
// ============================================

/**
 * Query execution plan from PostgreSQL EXPLAIN
 */
export interface QueryPlan {
  /** Plan type (e.g., 'Seq Scan', 'Index Scan', 'Bitmap Heap Scan') */
  nodeType: string;
  /** Relation being scanned */
  relationName?: string;
  /** Index being used (if any) */
  indexName?: string;
  /** Estimated startup cost */
  startupCost: number;
  /** Estimated total cost */
  totalCost: number;
  /** Estimated rows returned */
  planRows: number;
  /** Estimated width of each row */
  planWidth: number;
  /** Actual execution time (if EXPLAIN ANALYZE was used) */
  actualTime?: number;
  /** Actual rows returned */
  actualRows?: number;
  /** Number of loops */
  loops?: number;
  /** Filter condition */
  filter?: string;
  /** Index condition */
  indexCond?: string;
  /** Child plans */
  plans?: QueryPlan[];
  /** Warnings or notices */
  warnings?: string[];
}

/**
 * Index suggestion based on query analysis
 */
export interface IndexSuggestion {
  /** Table name */
  tableName: string;
  /** Columns to index */
  columns: string[];
  /** Suggested index type */
  indexType: 'btree' | 'hash' | 'gin' | 'gist' | 'brin';
  /** Whether to use partial index */
  isPartial: boolean;
  /** Partial index condition */
  whereClause?: string;
  /** Columns to include (covering index) */
  includeColumns?: string[];
  /** Reason for suggestion */
  reason: string;
  /** Estimated improvement */
  estimatedImprovement: 'low' | 'medium' | 'high';
  /** SQL to create the index */
  createStatement: string;
}

/**
 * Slow query log entry
 */
export interface SlowQueryLog {
  id?: string;
  queryHash: string;
  queryText: string;
  durationMs: number;
  rowsReturned?: number;
  rowsExamined?: number;
  indexUsed?: string;
  occurredAt: Date;
  context?: Record<string, unknown>;
  source?: string;
}

/**
 * Query performance statistics
 */
export interface QueryPerformanceStats {
  queryHash: string;
  queryPreview: string;
  executionCount: number;
  avgDurationMs: number;
  maxDurationMs: number;
  minDurationMs: number;
  p95DurationMs: number;
  lastOccurred: Date;
  source?: string;
}

/**
 * Index usage statistics
 */
export interface IndexUsageStats {
  schemaName: string;
  tableName: string;
  indexName: string;
  timesUsed: number;
  tuplesRead: number;
  tuplesFetched: number;
  indexSize: string;
  usageCategory: 'UNUSED' | 'LOW_USAGE' | 'MODERATE' | 'HIGH_USAGE';
}

/**
 * Options for slow query logging
 */
export interface LogSlowQueryOptions {
  queryText: string;
  durationMs: number;
  rowsReturned?: number;
  rowsExamined?: number;
  indexUsed?: string;
  context?: Record<string, unknown>;
  source?: string;
}

// ============================================
// CONSTANTS
// ============================================

/** Default slow query threshold in milliseconds */
export const DEFAULT_SLOW_QUERY_THRESHOLD_MS = 100;

/** Default query timeout in milliseconds */
export const DEFAULT_QUERY_TIMEOUT_MS = 30000;

/** Maximum query text length to log */
export const MAX_QUERY_TEXT_LENGTH = 5000;

// ============================================
// SLOW QUERY LOGGING
// ============================================

/**
 * Log a slow query to the database
 * 
 * @param options - Query logging options
 * @returns The log entry ID if successful
 */
export async function logSlowQuery(options: LogSlowQueryOptions): Promise<string | null> {
  const {
    queryText,
    durationMs,
    rowsReturned,
    rowsExamined,
    indexUsed,
    context = {},
    source,
  } = options;

  try {
    const truncatedQuery = queryText.slice(0, MAX_QUERY_TEXT_LENGTH);
    
    const { data, error } = await supabase.rpc('log_slow_query', {
      p_query_text: truncatedQuery,
      p_duration_ms: durationMs,
      p_rows_returned: rowsReturned ?? null,
      p_rows_examined: rowsExamined ?? null,
      p_index_used: indexUsed ?? null,
      p_context: context,
      p_source: source ?? null,
    });

    if (error) {
      logger.warn('Failed to log slow query', { error: error.message });
      return null;
    }

    return data as string;
  } catch (err) {
    logger.error('Error logging slow query', { error: err });
    return null;
  }
}

/**
 * Create a query timer that automatically logs slow queries
 * 
 * @param queryDescription - Description of the query for logging
 * @param source - Source module name
 * @param thresholdMs - Slow query threshold in milliseconds
 * @returns Timer object with done() method
 * 
 * @example
 * ```typescript
 * const timer = createQueryTimer('getEventById', 'events-service');
 * const { data } = await supabase.from('events').select('*').eq('id', id);
 * timer.done(data?.length ?? 0);
 * ```
 */
export function createQueryTimer(
  queryDescription: string,
  source: string,
  thresholdMs: number = DEFAULT_SLOW_QUERY_THRESHOLD_MS
): {
  done: (rowsReturned?: number, context?: Record<string, unknown>) => void;
  getDuration: () => number;
} {
  const startTime = performance.now();
  
  return {
    done: (rowsReturned?: number, context?: Record<string, unknown>) => {
      const durationMs = performance.now() - startTime;
      
      if (durationMs >= thresholdMs) {
        logger.warn('Slow query detected', {
          query: queryDescription,
          durationMs: Math.round(durationMs),
          threshold: thresholdMs,
          rowsReturned,
        });
        
        // Log to database asynchronously
        logSlowQuery({
          queryText: queryDescription,
          durationMs,
          rowsReturned,
          context,
          source,
        }).catch(() => {}); // Fire and forget
      }
    },
    getDuration: () => performance.now() - startTime,
  };
}

// ============================================
// QUERY ANALYSIS
// ============================================

/**
 * Analyze a query using PostgreSQL EXPLAIN
 * 
 * @param query - SQL query to analyze
 * @param analyze - Whether to actually execute the query (EXPLAIN ANALYZE)
 * @returns Query execution plan
 */
export async function explainQuery(
  query: string,
  analyze: boolean = false
): Promise<QueryPlan | null> {
  try {
    const explainQuery = analyze
      ? `EXPLAIN (ANALYZE, FORMAT JSON) ${query}`
      : `EXPLAIN (FORMAT JSON) ${query}`;
    
    const { data, error } = await supabase.rpc('execute_sql', {
      sql_query: explainQuery,
    });
    
    if (error) {
      logger.error('EXPLAIN query failed', { error: error.message });
      return null;
    }
    
    // Parse the JSON plan
    if (data && Array.isArray(data) && data[0]?.['QUERY PLAN']) {
      const plan = data[0]['QUERY PLAN'][0]?.Plan;
      return parseQueryPlan(plan);
    }
    
    return null;
  } catch (err) {
    logger.error('Error explaining query', { error: err });
    return null;
  }
}

/**
 * Parse PostgreSQL EXPLAIN JSON output into QueryPlan
 */
function parseQueryPlan(plan: any): QueryPlan {
  if (!plan) {
    return {
      nodeType: 'Unknown',
      startupCost: 0,
      totalCost: 0,
      planRows: 0,
      planWidth: 0,
    };
  }
  
  const result: QueryPlan = {
    nodeType: plan['Node Type'] ?? 'Unknown',
    relationName: plan['Relation Name'],
    indexName: plan['Index Name'],
    startupCost: plan['Startup Cost'] ?? 0,
    totalCost: plan['Total Cost'] ?? 0,
    planRows: plan['Plan Rows'] ?? 0,
    planWidth: plan['Plan Width'] ?? 0,
    actualTime: plan['Actual Total Time'],
    actualRows: plan['Actual Rows'],
    loops: plan['Actual Loops'],
    filter: plan['Filter'],
    indexCond: plan['Index Cond'],
    warnings: [],
  };
  
  // Check for sequential scans on large tables (potential optimization)
  if (result.nodeType === 'Seq Scan' && result.planRows > 1000) {
    result.warnings = result.warnings || [];
    result.warnings.push(`Sequential scan on ${result.relationName} returning ${result.planRows} rows - consider adding an index`);
  }
  
  // Parse child plans
  if (plan.Plans && Array.isArray(plan.Plans)) {
    result.plans = plan.Plans.map(parseQueryPlan);
  }
  
  return result;
}

/**
 * Suggest indexes based on slow query patterns
 * 
 * @param slowQueries - Array of slow query texts
 * @returns Array of index suggestions
 */
export function suggestIndexes(slowQueries: string[]): IndexSuggestion[] {
  const suggestions: IndexSuggestion[] = [];
  const seenSuggestions = new Set<string>();
  
  for (const query of slowQueries) {
    const querySuggestions = analyzeQueryForIndexes(query);
    
    for (const suggestion of querySuggestions) {
      const key = `${suggestion.tableName}:${suggestion.columns.join(',')}`;
      if (!seenSuggestions.has(key)) {
        seenSuggestions.add(key);
        suggestions.push(suggestion);
      }
    }
  }
  
  return suggestions;
}

/**
 * Analyze a single query for potential index optimizations
 */
function analyzeQueryForIndexes(query: string): IndexSuggestion[] {
  const suggestions: IndexSuggestion[] = [];
  const normalizedQuery = query.toLowerCase();
  
  // Extract table name from FROM clause
  const fromMatch = normalizedQuery.match(/from\s+(\w+)/);
  if (!fromMatch) return suggestions;
  
  const tableName = fromMatch[1];
  
  // Extract WHERE conditions
  const whereMatch = normalizedQuery.match(/where\s+(.+?)(?:order|group|limit|$)/s);
  if (whereMatch) {
    const conditions = whereMatch[1];
    
    // Find columns used in equality conditions
    const eqMatches = conditions.matchAll(/(\w+)\s*=\s*(?:\$\d+|'[^']*'|\d+)/g);
    const eqColumns: string[] = [];
    for (const match of eqMatches) {
      eqColumns.push(match[1]);
    }
    
    // Find columns used in IN conditions
    const inMatches = conditions.matchAll(/(\w+)\s+in\s*\(/gi);
    for (const match of inMatches) {
      if (!eqColumns.includes(match[1])) {
        eqColumns.push(match[1]);
      }
    }
    
    if (eqColumns.length > 0) {
      suggestions.push({
        tableName,
        columns: eqColumns,
        indexType: 'btree',
        isPartial: false,
        reason: `WHERE clause filters on ${eqColumns.join(', ')}`,
        estimatedImprovement: eqColumns.length > 1 ? 'high' : 'medium',
        createStatement: `CREATE INDEX IF NOT EXISTS idx_${tableName}_${eqColumns.join('_')} ON ${tableName}(${eqColumns.join(', ')});`,
      });
    }
  }
  
  // Extract ORDER BY columns
  const orderMatch = normalizedQuery.match(/order\s+by\s+(\w+)(?:\s+(asc|desc))?/);
  if (orderMatch) {
    const orderColumn = orderMatch[1];
    const direction = orderMatch[2] || 'asc';
    
    suggestions.push({
      tableName,
      columns: [orderColumn],
      indexType: 'btree',
      isPartial: false,
      reason: `ORDER BY ${orderColumn} ${direction}`,
      estimatedImprovement: 'medium',
      createStatement: `CREATE INDEX IF NOT EXISTS idx_${tableName}_${orderColumn}_${direction} ON ${tableName}(${orderColumn} ${direction.toUpperCase()});`,
    });
  }
  
  return suggestions;
}

// ============================================
// QUERY PERFORMANCE DATA RETRIEVAL
// ============================================

/**
 * Get slow query statistics from the last N hours
 * 
 * @param hours - Number of hours to look back
 * @param limit - Maximum number of results
 * @returns Array of query performance statistics
 */
export async function getSlowQueryStats(
  hours: number = 24,
  limit: number = 50
): Promise<QueryPerformanceStats[]> {
  try {
    const { data, error } = await supabase
      .from('query_performance_logs')
      .select('*')
      .gte('occurred_at', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
      .order('duration_ms', { ascending: false })
      .limit(limit);
    
    if (error) {
      logger.error('Failed to get slow query stats', { error: error.message });
      return [];
    }
    
    // Group by query hash and calculate stats
    const statsMap = new Map<string, QueryPerformanceStats>();
    
    for (const log of data ?? []) {
      const existing = statsMap.get(log.query_hash);
      
      if (existing) {
        existing.executionCount++;
        existing.avgDurationMs = (existing.avgDurationMs * (existing.executionCount - 1) + log.duration_ms) / existing.executionCount;
        existing.maxDurationMs = Math.max(existing.maxDurationMs, log.duration_ms);
        existing.minDurationMs = Math.min(existing.minDurationMs, log.duration_ms);
        if (new Date(log.occurred_at) > existing.lastOccurred) {
          existing.lastOccurred = new Date(log.occurred_at);
        }
      } else {
        statsMap.set(log.query_hash, {
          queryHash: log.query_hash,
          queryPreview: log.query_text.slice(0, 100),
          executionCount: 1,
          avgDurationMs: log.duration_ms,
          maxDurationMs: log.duration_ms,
          minDurationMs: log.duration_ms,
          p95DurationMs: log.duration_ms,
          lastOccurred: new Date(log.occurred_at),
          source: log.source,
        });
      }
    }
    
    return Array.from(statsMap.values())
      .sort((a, b) => b.avgDurationMs - a.avgDurationMs);
  } catch (err) {
    logger.error('Error getting slow query stats', { error: err });
    return [];
  }
}

/**
 * Get recent slow queries
 * 
 * @param limit - Maximum number of results
 * @returns Array of slow query logs
 */
export async function getRecentSlowQueries(limit: number = 20): Promise<SlowQueryLog[]> {
  try {
    const { data, error } = await supabase
      .from('query_performance_logs')
      .select('*')
      .order('occurred_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      logger.error('Failed to get recent slow queries', { error: error.message });
      return [];
    }
    
    return (data ?? []).map(log => ({
      id: log.id,
      queryHash: log.query_hash,
      queryText: log.query_text,
      durationMs: log.duration_ms,
      rowsReturned: log.rows_returned,
      rowsExamined: log.rows_examined,
      indexUsed: log.index_used,
      occurredAt: new Date(log.occurred_at),
      context: log.context,
      source: log.source,
    }));
  } catch (err) {
    logger.error('Error getting recent slow queries', { error: err });
    return [];
  }
}

/**
 * Get index usage statistics
 * 
 * @returns Array of index usage statistics
 */
export async function getIndexUsageStats(): Promise<IndexUsageStats[]> {
  try {
    const { data, error } = await supabase
      .from('index_usage_stats')
      .select('*');
    
    if (error) {
      logger.error('Failed to get index usage stats', { error: error.message });
      return [];
    }
    
    return (data ?? []).map(stat => ({
      schemaName: stat.schemaname,
      tableName: stat.tablename,
      indexName: stat.indexname,
      timesUsed: stat.times_used,
      tuplesRead: stat.tuples_read,
      tuplesFetched: stat.tuples_fetched,
      indexSize: stat.index_size,
      usageCategory: stat.usage_category,
    }));
  } catch (err) {
    logger.error('Error getting index usage stats', { error: err });
    return [];
  }
}

// ============================================
// OPTIMIZED QUERY BUILDER
// ============================================

/**
 * Query builder with optimization hints and timeout handling
 */
export class OptimizedQueryBuilder<T = any> {
  private client = supabase;
  private tableName: string = '';
  private selectColumns: string[] = ['*'];
  private filters: Array<{ column: string; operator: string; value: any }> = [];
  private orderByColumns: Array<{ column: string; ascending: boolean }> = [];
  private limitValue?: number;
  private offsetValue?: number;
  private timeoutMs: number = DEFAULT_QUERY_TIMEOUT_MS;
  private queryDescription: string = '';
  private source: string = 'query-builder';

  /**
   * Set the table to query
   */
  from(table: string): this {
    this.tableName = table;
    this.queryDescription = `SELECT FROM ${table}`;
    return this;
  }

  /**
   * Select columns using covering index pattern
   * Selects only the columns included in a covering index to avoid table lookups
   */
  selectWithCovering(columns: string[]): this {
    this.selectColumns = columns;
    return this;
  }

  /**
   * Select all columns
   */
  select(columns: string = '*'): this {
    this.selectColumns = columns === '*' ? ['*'] : columns.split(',').map(c => c.trim());
    return this;
  }

  /**
   * Add an equality filter
   */
  eq(column: string, value: any): this {
    this.filters.push({ column, operator: 'eq', value });
    return this;
  }

  /**
   * Add an IN filter
   */
  in(column: string, values: any[]): this {
    this.filters.push({ column, operator: 'in', value: values });
    return this;
  }

  /**
   * Add a greater-than-or-equal filter
   */
  gte(column: string, value: any): this {
    this.filters.push({ column, operator: 'gte', value });
    return this;
  }

  /**
   * Add a less-than-or-equal filter
   */
  lte(column: string, value: any): this {
    this.filters.push({ column, operator: 'lte', value });
    return this;
  }

  /**
   * Limit the scan range for better performance
   * Uses indexed columns to bound the query
   */
  limitScanRange(column: string, start: any, end: any): this {
    this.filters.push({ column, operator: 'gte', value: start });
    this.filters.push({ column, operator: 'lte', value: end });
    return this;
  }

  /**
   * Add ordering
   */
  order(column: string, options?: { ascending?: boolean }): this {
    this.orderByColumns.push({
      column,
      ascending: options?.ascending ?? true,
    });
    return this;
  }

  /**
   * Set query limit
   */
  limit(count: number): this {
    this.limitValue = count;
    return this;
  }

  /**
   * Set query offset
   */
  offset(count: number): this {
    this.offsetValue = count;
    return this;
  }

  /**
   * Set query timeout
   */
  withTimeout(ms: number): this {
    this.timeoutMs = ms;
    return this;
  }

  /**
   * Set source for logging
   */
  withSource(source: string): this {
    this.source = source;
    return this;
  }

  /**
   * Execute the query with performance monitoring
   */
  async execute(): Promise<{ data: T[] | null; error: Error | null; durationMs: number }> {
    const timer = createQueryTimer(this.buildQueryDescription(), this.source);
    
    try {
      let query = this.client.from(this.tableName).select(this.selectColumns.join(', '));
      
      // Apply filters
      for (const filter of this.filters) {
        switch (filter.operator) {
          case 'eq':
            query = query.eq(filter.column, filter.value);
            break;
          case 'in':
            query = query.in(filter.column, filter.value);
            break;
          case 'gte':
            query = query.gte(filter.column, filter.value);
            break;
          case 'lte':
            query = query.lte(filter.column, filter.value);
            break;
        }
      }
      
      // Apply ordering
      for (const order of this.orderByColumns) {
        query = query.order(order.column, { ascending: order.ascending });
      }
      
      // Apply pagination
      if (this.limitValue !== undefined) {
        query = query.limit(this.limitValue);
      }
      
      if (this.offsetValue !== undefined && this.limitValue !== undefined) {
        query = query.range(this.offsetValue, this.offsetValue + this.limitValue - 1);
      }
      
      // Execute with timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Query timeout after ${this.timeoutMs}ms`)), this.timeoutMs);
      });
      
      const { data, error } = await Promise.race([
        query,
        timeoutPromise,
      ]) as { data: T[] | null; error: any };
      
      const durationMs = timer.getDuration();
      timer.done(data?.length ?? 0);
      
      if (error) {
        return { data: null, error: new Error(error.message), durationMs };
      }
      
      return { data, error: null, durationMs };
    } catch (err) {
      const durationMs = timer.getDuration();
      return { 
        data: null, 
        error: err instanceof Error ? err : new Error(String(err)), 
        durationMs 
      };
    }
  }

  /**
   * Build a description of the query for logging
   */
  private buildQueryDescription(): string {
    let desc = `SELECT ${this.selectColumns.join(', ')} FROM ${this.tableName}`;
    
    if (this.filters.length > 0) {
      const filterDescs = this.filters.map(f => `${f.column} ${f.operator} ?`);
      desc += ` WHERE ${filterDescs.join(' AND ')}`;
    }
    
    if (this.orderByColumns.length > 0) {
      const orderDescs = this.orderByColumns.map(o => `${o.column} ${o.ascending ? 'ASC' : 'DESC'}`);
      desc += ` ORDER BY ${orderDescs.join(', ')}`;
    }
    
    if (this.limitValue !== undefined) {
      desc += ` LIMIT ${this.limitValue}`;
    }
    
    return desc;
  }
}

/**
 * Create a new optimized query builder
 */
export function createOptimizedQuery<T = any>(): OptimizedQueryBuilder<T> {
  return new OptimizedQueryBuilder<T>();
}

// ============================================
// EXPORTS
// ============================================

export const queryOptimizer = {
  // Slow query logging
  logSlowQuery,
  createQueryTimer,
  
  // Query analysis
  explainQuery,
  suggestIndexes,
  
  // Statistics retrieval
  getSlowQueryStats,
  getRecentSlowQueries,
  getIndexUsageStats,
  
  // Query builder
  createOptimizedQuery,
  OptimizedQueryBuilder,
  
  // Constants
  DEFAULT_SLOW_QUERY_THRESHOLD_MS,
  DEFAULT_QUERY_TIMEOUT_MS,
};

export default queryOptimizer;
