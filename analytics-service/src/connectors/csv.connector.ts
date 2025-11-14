import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { BaseConnector } from './base.connector';
import {
  SchemaMetadata,
  ColumnProfile,
  DataSourceConfig,
  ConnectionTestResult,
  SampleFetchResult,
  CSVConfig,
  DataType,
  ColumnMetadata,
} from './types';

export class CSVConnector extends BaseConnector {
  private data: any[] | null = null;
  private headers: string[] | null = null;

  constructor(config: DataSourceConfig) {
    super(config);
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const csvConfig = this.getConfig<CSVConfig>();
      const filePath = this.resolvePath(csvConfig.path);

      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          message: 'File not found',
          error: `CSV file not found at ${filePath}`,
        };
      }

      const fileSize = fs.statSync(filePath).size;
      if (fileSize === 0) {
        return {
          success: false,
          message: 'File is empty',
          error: 'CSV file is empty',
        };
      }

      // Try to read first few lines
      await this.loadData(10);

      return {
        success: true,
        message: 'Connection successful',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Connection failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async discoverSchema(): Promise<SchemaMetadata> {
    await this.loadData();

    if (!this.headers || this.headers.length === 0) {
      throw new Error('No headers found in CSV file');
    }

    const columns: ColumnMetadata[] = this.inferColumnTypes();

    return {
      path: this.getConfig<CSVConfig>().path,
      columns,
      rowCount: this.data?.length || 0,
    };
  }

  async getSamples(limit: number = 10): Promise<SampleFetchResult> {
    await this.loadData(limit * 2);

    const samples = (this.data || []).slice(0, limit);
    const totalCount = this.data?.length || 0;

    return {
      data: samples,
      count: samples.length,
      totalCount,
    };
  }

  async profileColumns(sampleSize: number = 1000): Promise<ColumnProfile[]> {
    await this.loadData(sampleSize);

    if (!this.headers) {
      return [];
    }

    const profiles: ColumnProfile[] = [];

    for (const header of this.headers) {
      const values = (this.data || [])
        .map(row => row[header])
        .filter((v: any) => v !== null && v !== undefined && v !== '');

      const nullCount = (this.data || []).length - values.length;
      const uniqueValues = [...new Set(values)];
      const sampleValues = values.slice(0, 5);

      let minValue: any;
      let maxValue: any;

      // Try to parse as numbers
      const numericValues = values.map((v: any) => parseFloat(v)).filter(v => !isNaN(v));
      if (numericValues.length > 0) {
        minValue = Math.min(...numericValues);
        maxValue = Math.max(...numericValues);
      }

      profiles.push({
        name: header,
        type: this.inferType(values),
        nullCount,
        uniqueCount: uniqueValues.length,
        sampleValues: sampleValues.slice(0, 5),
        minValue,
        maxValue,
        mostCommon: this.getMostCommon(values),
      });
    }

    return profiles;
  }

  async close(): Promise<void> {
    this.data = null;
    this.headers = null;
  }

  private async loadData(limit?: number): Promise<void> {
    if (this.data !== null) {
      return;
    }

    const csvConfig = this.getConfig<CSVConfig>();
    const filePath = this.resolvePath(csvConfig.path);

    if (!fs.existsSync(filePath)) {
      throw new Error(`CSV file not found: ${filePath}`);
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');

    // Auto-detect delimiter if not specified
    const delimiter = csvConfig.delimiter || this.detectDelimiter(fileContent);

    try {
      const records = parse(fileContent, {
        delimiter,
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relaxQuotes: true,
      });

      this.data = limit ? records.slice(0, limit) : records;
      this.headers = this.data && this.data.length > 0 ? Object.keys(this.data[0] || {}) : [];
    } catch (error) {
      throw new Error(`Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private detectDelimiter(content: string): string {
    // Check for common delimiters in first line
    const firstLine = content.split('\n')[0];
    const delimiters = [',', ';', '\t', '|'];

    for (const delimiter of delimiters) {
      if (firstLine.includes(delimiter)) {
        return delimiter;
      }
    }

    return ','; // Default to comma
  }

  private inferColumnTypes(): ColumnMetadata[] {
    if (!this.data || !this.headers) {
      return [];
    }

    const columns: ColumnMetadata[] = [];

    for (const header of this.headers) {
      const values = this.data
        .map(row => row[header])
        .filter((v: any) => v !== null && v !== undefined && v !== '');

      const type = this.inferType(values);

      columns.push({
        name: header,
        type,
        nullable: values.length < this.data.length,
      });
    }

    return columns;
  }

  private inferType(values: any[]): DataType {
    if (values.length === 0) {
      return DataType.STRING;
    }

    let stringCount = 0;
    let intCount = 0;
    let floatCount = 0;
    let boolCount = 0;
    let dateCount = 0;

    for (const value of values) {
      const strValue = String(value).toLowerCase().trim();

      // Check boolean
      if (strValue === 'true' || strValue === 'false') {
        boolCount++;
      }
      // Check integer
      else if (/^-?\d+$/.test(strValue)) {
        intCount++;
      }
      // Check float
      else if (/^-?\d+\.\d+$/.test(strValue)) {
        floatCount++;
      }
      // Check date
      else if (this.isDate(strValue)) {
        dateCount++;
      } else {
        stringCount++;
      }
    }

    const total = values.length;
    const threshold = 0.8; // 80% threshold

    if (boolCount / total > threshold) return DataType.BOOLEAN;
    if (dateCount / total > threshold) return DataType.DATE;
    if ((intCount + floatCount) / total > threshold) {
      if (floatCount / (intCount + floatCount) > 0.1) return DataType.FLOAT;
      return DataType.INTEGER;
    }

    return DataType.STRING;
  }

  private isDate(value: string): boolean {
    // Common date formats
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
      /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
      /^\d{2}-\d{2}-\d{4}$/, // DD-MM-YYYY
      /^\d{4}\/\d{2}\/\d{2}$/, // YYYY/MM/DD
    ];

    return datePatterns.some(pattern => pattern.test(value));
  }

  private getMostCommon(values: any[]): any {
    if (values.length === 0) return null;

    const counts: Record<string, number> = {};
    let maxCount = 0;
    let mostCommon: any = null;

    for (const value of values) {
      const key = String(value);
      counts[key] = (counts[key] || 0) + 1;

      if (counts[key] > maxCount) {
        maxCount = counts[key];
        mostCommon = value;
      }
    }

    return mostCommon;
  }

  private resolvePath(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    return path.join(process.cwd(), filePath);
  }
}
