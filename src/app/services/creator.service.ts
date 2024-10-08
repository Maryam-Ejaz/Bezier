import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { StreamingResult, PromptResponse } from '../types';
import { ChatGPTAPIService } from './chatgpt-api.service';
import { DefaultPrompt, GivenSVGPrompt } from './svg-prompt';

const SVG_REG_EXP: RegExp = /<svg[\s\S]*?<\/svg>/gi;

@Injectable({
  providedIn: 'root',
})
export class CreatorService {
  public svgCode$ = new Subject<StreamingResult>();
  private abortCtl?: AbortController;

  constructor(private api: ChatGPTAPIService) {}

  async analyzeInputStreaming(msg: string, originalSVGCode: string, originalReasoning: string) {
    let finalMsg = '';
    if (originalSVGCode) {
      finalMsg = GivenSVGPrompt.replace(/\{svg\}/g, originalSVGCode).replace(
        /\{reasoning\}/g,
        originalReasoning || 'unknown'
      );
    } else {
      finalMsg = DefaultPrompt;
    }
    finalMsg = finalMsg.replace(/\{input\}/g, msg);
    this.abortCtl = new AbortController();
    const rsp = await this.api.doChatStream(
      [
        {
          role: 'user',
          content: finalMsg,
        },
      ],
      this.svgCode$,
      this.abortCtl.signal
    );
    if (!rsp) {
      return;
    }
  }

  stopAnalyze() {
    this.abortCtl?.abort();
  }

  extractSVGCode(str: string) {
    const svgMatches: string[] = str.match(SVG_REG_EXP) || [];
    return svgMatches;
  }

  extractNonSVGCode(str: string) {
    return str.replace(SVG_REG_EXP, '').trim();
  }

  extractResult(str: string): PromptResponse {
    try {
      const res: PromptResponse = JSON.parse(str);
      return res;
    } catch (err) {
      // fallback：
      const svg = this.extractSVGCode(str);
      return {
        Keywords: [],
        Reasoning: 'unknown',
        SVG: svg.length ? svg.join('\n') : '',
      };
    }
  }
}
