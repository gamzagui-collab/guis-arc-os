import {isAutoMatchAlias,SITE_TRADE_CONFLICTS,SITE_TRADE_DICTIONARY} from "./trade-data/index.js";

const DISPLAY_MARKS = /[▶▷▸◆◇]/g;
const AUTO_RANK = {
  EXACT_RAW: 90,
  EXACT_NORMALIZED: 80,
  CONFIRMED_ALIAS: 70,
  CANONICAL_EXACT: 60,
  COMPOSITE_BASE: 50,
  SAFE_MULTI_KEYWORD: 40,
};

export const SITE_CANONICAL_TRADES = SITE_TRADE_DICTIONARY;

const normalizeSpaces = (value) =>
  String(value ?? "")
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();

export function normalizeTradeName(value) {
  return normalizeSpaces(value).replace(DISPLAY_MARKS, " ").replace(/\s+/g, "").trim();
}

export function parseCompositeTrade(value) {
  const raw = normalizeSpaces(value).replace(/^[▶▷▸◆◇]\s*/, "");
  const match = /^([^()]*)\(([\s\S]*)\)\s*$/.exec(raw);
  const baseTradeRaw = (match?.[1] || raw).trim();
  const detailsRaw = match?.[2]?.trim() || null;
  const detailTokens = detailsRaw
    ? detailsRaw.split(/[,，/]/).map((token) => {
        const item = token.trim();
        const parts = /^(.*?)(?:\s*[-:]\s*)(-?\d+(?:\.\d+)?)\s*(?:명)?$/.exec(item);
        return { raw: item, nameRaw: (parts?.[1] || item).trim(), numberRaw: parts?.[2] ?? null };
      })
    : [];
  return {
    raw,
    baseTradeRaw,
    baseTradeNormalized: normalizeTradeName(baseTradeRaw),
    detailsRaw,
    detailTokens,
  };
}

const aliasIndex = new Map();
for (const trade of SITE_CANONICAL_TRADES) {
  for (const alias of trade.aliases) {
    if(isAutoMatchAlias(alias))aliasIndex.set(normalizeTradeName(alias.value), {trade,alias});
  }
}

export function resolveCanonicalTrade(value) {
  const parsed = parseCompositeTrade(value);
  const resolved = aliasIndex.get(parsed.baseTradeNormalized) || null;
  const trade = resolved?.trade || null;
  return {
    ...parsed,
    canonicalTradeId: trade?.canonicalTradeId || "UNKNOWN",
    displayNameKo: trade?.displayNameKo || parsed.baseTradeRaw,
    category: trade?.category || "미분류",
    keywords: trade?.keywords || [],
    aliasStatus: resolved?.alias?.status || null,
  };
}

const keywordTokens = (value) => {
  const normalized = normalizeTradeName(parseCompositeTrade(value).baseTradeRaw).toLowerCase();
  return [...new Set(SITE_CANONICAL_TRADES.flatMap((trade) => trade.keywords))]
    .filter((word) => normalized.includes(word.toLowerCase()))
    .filter((word) => !["공", "공사", "작업", "설비"].includes(word));
};

const conflictFor = (output, work) => {
  for (const {leftCanonicalTradeId:left,rightCanonicalTradeId:right,reasonKo} of SITE_TRADE_CONFLICTS) {
    const ids = new Set([output.canonicalTradeId, work.canonicalTradeId]);
    if (ids.has(left) && ids.has(right)) return reasonKo;
  }
  if (
    output.canonicalTradeId === "MECHANICAL" &&
    /전기/.test(work.baseTradeRaw)
  ) {
    return "기계설비와 전기설비는 서로 다른 공종으로 판단합니다.";
  }
  return null;
};

export function matchTradeNames(outputTradeRaw, workTradeRaw) {
  const output = resolveCanonicalTrade(outputTradeRaw);
  const work = resolveCanonicalTrade(workTradeRaw);
  const normalizedOutputTrade = output.baseTradeNormalized;
  const normalizedWorkTrade = work.baseTradeNormalized;
  const workKeywords = keywordTokens(workTradeRaw);
  const sharedKeywords = keywordTokens(outputTradeRaw).filter((word) => workKeywords.includes(word));
  const conflict = conflictFor(output, work);
  const result = {
    outputTradeRaw: String(outputTradeRaw ?? "").trim(),
    workTradeRaw: String(workTradeRaw ?? "").trim(),
    normalizedOutputTrade,
    normalizedWorkTrade,
    canonicalOutputTradeId: output.canonicalTradeId,
    canonicalWorkTradeId: work.canonicalTradeId,
    sharedKeywords,
    conflictReasons: conflict ? [conflict] : [],
    rejectedReasons: [],
    evidence: [],
    matchType: "UNMATCHED",
    matched: false,
    requiresReview: false,
    confidence: "NONE",
    matchScore: null,
    matchReasonKo: "일치하는 현재 현장 공종 근거가 없습니다.",
    warningCode: "TRADE_UNMATCHED",
  };

  if (conflict) {
    Object.assign(result, {
      matchType: "CONFLICT",
      requiresReview: true,
      confidence: "HIGH",
      matchReasonKo: conflict,
      warningCode: "TRADE_MATCH_CONFLICT",
    });
  } else if (result.outputTradeRaw && result.outputTradeRaw === result.workTradeRaw) {
    Object.assign(result, {
      matchType: "EXACT_RAW",
      matched: true,
      confidence: "HIGH",
      matchScore: 1,
      matchReasonKo: "출력현황과 작업예정사항의 공종 원문이 같습니다.",
      warningCode: null,
    });
  } else if (
    work.detailsRaw !== null &&
    output.canonicalTradeId !== "UNKNOWN" &&
    output.canonicalTradeId === work.canonicalTradeId
  ) {
    Object.assign(result, {
      matchType: "COMPOSITE_BASE",
      matched: true,
      confidence: "HIGH",
      matchScore: 0.96,
      matchReasonKo: "복합 공종의 기본 공종이 출력현황과 같습니다.",
      warningCode: null,
    });
    result.evidence.push({
      type: "SITE_CANONICAL_TRADE",
      canonicalTradeId: output.canonicalTradeId,
    });
  } else if (normalizedOutputTrade && normalizedOutputTrade === normalizedWorkTrade) {
    Object.assign(result, {
      matchType: "EXACT_NORMALIZED",
      matched: true,
      confidence: "HIGH",
      matchScore: 0.99,
      matchReasonKo: "공백과 표시 기호를 정리한 공종명이 같습니다.",
      warningCode: null,
    });
  } else if (
    output.canonicalTradeId !== "UNKNOWN" &&
    output.canonicalTradeId === work.canonicalTradeId
  ) {
    Object.assign(result, {
      matchType: output.aliasStatus==="CONFIRMED"&&work.aliasStatus==="CONFIRMED"
          ? "CONFIRMED_ALIAS"
          : "CANONICAL_EXACT",
      matched: true,
      confidence: "HIGH",
      matchScore: 0.97,
      matchReasonKo: "현재 현장에서 확인된 동일 표준 공종입니다.",
      warningCode: null,
    });
    result.evidence.push({
      type: "SITE_CANONICAL_TRADE",
      canonicalTradeId: output.canonicalTradeId,
    });
  } else if (sharedKeywords.length >= 2) {
    Object.assign(result, {
      matchType: "SAFE_MULTI_KEYWORD",
      matched: true,
      confidence: "MEDIUM",
      matchScore:
        sharedKeywords.length /
        Math.max(keywordTokens(outputTradeRaw).length, keywordTokens(workTradeRaw).length),
      matchReasonKo: `현재 현장의 핵심어 ${sharedKeywords.join(", ")}가 함께 일치합니다.`,
      warningCode: null,
    });
  } else if (sharedKeywords.length) {
    Object.assign(result, {
      matchType: "REVIEW_REQUIRED",
      requiresReview: true,
      confidence: "LOW",
      matchScore: 0,
      matchReasonKo: `'${sharedKeywords.join(", ")}' 표현만으로는 같은 공종인지 확정할 수 없습니다.`,
      warningCode: "TRADE_MATCH_REVIEW_REQUIRED",
    });
  }

  const parentheticalNumbers = work.detailTokens
    .map((item) => Number(item.numberRaw))
    .filter(Number.isFinite);
  if (parentheticalNumbers.length) {
    result.evidence.push({
      type: "PAREN_DETAIL_NUMBERS",
      valuesRaw: work.detailTokens.map((item) => item.numberRaw),
      sum: parentheticalNumbers.reduce((sum, value) => sum + value, 0),
      officialWorkforce: false,
    });
  }
  return { ...result, matchReason: result.matchReasonKo };
}

export const explainTradeMatch = (result) =>
  result?.matchReasonKo || "공종 연결 근거가 없습니다.";

export function reconcileWorkforceTrades(trades = [], plannedWorkItems = []) {
  const outputRows = trades.map((trade, index) => ({
    ...trade,
    index,
    canonical: resolveCanonicalTrade(trade.trade),
  }));
  const workGroups = new Map();
  plannedWorkItems.forEach((item, index) => {
    const canonical = resolveCanonicalTrade(item.trade);
    const key =
      canonical.canonicalTradeId !== "UNKNOWN"
        ? canonical.canonicalTradeId
        : `RAW:${canonical.baseTradeNormalized}`;
    if (!workGroups.has(key)) workGroups.set(key, { key, canonical, trade: item.trade, indexes: [] });
    workGroups.get(key).indexes.push(index);
  });

  const groups = [...workGroups.values()];
  const evaluated = [];
  for (const output of outputRows) {
    if (output.canonical.canonicalTradeId === "STAFF") continue;
    for (const group of groups) {
      const match = matchTradeNames(output.trade, group.trade);
      evaluated.push({ output, group, match, rank: AUTO_RANK[match.matchType] || 0 });
    }
  }

  const ambiguousGroups = new Set();
  for (const group of groups) {
    const candidates = evaluated
      .filter((item) => item.group === group && item.match.matched)
      .sort(
        (a, b) =>
          b.rank - a.rank ||
          (b.match.matchScore || 0) - (a.match.matchScore || 0) ||
          a.match.outputTradeRaw.localeCompare(b.match.outputTradeRaw, "ko"),
      );
    if (
      candidates[1] &&
      candidates[0].rank === candidates[1].rank &&
      candidates[0].match.matchScore === candidates[1].match.matchScore
    ) {
      ambiguousGroups.add(group.key);
    }
  }

  evaluated.sort(
    (a, b) =>
      b.rank - a.rank ||
      (b.match.matchScore || 0) - (a.match.matchScore || 0) ||
      a.match.outputTradeRaw.localeCompare(b.match.outputTradeRaw, "ko") ||
      a.match.workTradeRaw.localeCompare(b.match.workTradeRaw, "ko"),
  );
  const assignments = new Map();
  const usedOutputs = new Set();
  for (const candidate of evaluated) {
    if (
      !candidate.match.matched ||
      ambiguousGroups.has(candidate.group.key) ||
      assignments.has(candidate.group.key) ||
      usedOutputs.has(candidate.output.index)
    ) continue;
    assignments.set(candidate.group.key, candidate);
    usedOutputs.add(candidate.output.index);
  }

  const workforceWarnings = [];
  const reconciledItems = plannedWorkItems.map((item, index) => {
    const canonical = resolveCanonicalTrade(item.trade);
    const key =
      canonical.canonicalTradeId !== "UNKNOWN"
        ? canonical.canonicalTradeId
        : `RAW:${canonical.baseTradeNormalized}`;
    const group = workGroups.get(key);
    const assignment = assignments.get(key);
    const first = group.indexes[0] === index;
    let tradeMatch = assignment
      ? {
          ...assignment.match,
          sourceOutputCell: assignment.output.sourceCellRange || null,
          sourceWorkCell: item.sourceCellRange || null,
          workDescriptionRaw: item.rawText || item.description || null,
        }
      : null;

    if (tradeMatch && assignment.output.plannedWorkforce != null) {
      const parenthetical = tradeMatch.evidence.find(
        (value) => value.type === "PAREN_DETAIL_NUMBERS",
      );
      if (parenthetical) {
        const matches = parenthetical.sum === assignment.output.plannedWorkforce;
        tradeMatch = {
          ...tradeMatch,
          evidence: [
            ...tradeMatch.evidence,
            {
              type: matches ? "PAREN_WORKFORCE_MATCH" : "PAREN_WORKFORCE_MISMATCH",
              parenSum: parenthetical.sum,
              outputWorkforce: assignment.output.plannedWorkforce,
              officialWorkforceSource: "OUTPUT_STATUS",
            },
          ],
        };
        if (!matches) {
          workforceWarnings.push({
            code: "PAREN_WORKFORCE_MISMATCH",
            message:
              "작업 제목의 괄호 숫자 합계와 출력현황 인원이 달라 출력현황 인원을 기준으로 표시합니다.",
            workTradeRaw: item.trade,
          });
        }
      }
    }

    if (!assignment && first) {
      if (ambiguousGroups.has(key)) {
        const candidates = evaluated
          .filter((value) => value.group === group && value.match.matched)
          .map((value) => value.output.trade);
        const message = `같은 수준의 공종 후보(${candidates.join(", ")})가 여러 개라 자동 연결하지 않았습니다.`;
        workforceWarnings.push({
          code: "TRADE_MATCH_MULTIPLE_CANDIDATES",
          message,
          workTradeRaw: item.trade,
          outputTradeCandidates: candidates,
        });
        tradeMatch = {
          ...evaluated.find((value) => value.group === group && value.match.matched)?.match,
          matched: false,
          requiresReview: true,
          matchType: "MULTIPLE_CANDIDATES",
          matchReasonKo: message,
          matchReason: message,
          warningCode: "TRADE_MATCH_MULTIPLE_CANDIDATES",
          sourceOutputCell: null,
          sourceWorkCell: item.sourceCellRange || null,
          workDescriptionRaw: item.rawText || item.description || null,
        };
      }
      const review = evaluated
        .filter((value) => value.group === group && value.match.requiresReview)
        .sort((a, b) => a.match.matchType.localeCompare(b.match.matchType))[0];
      if (!ambiguousGroups.has(key)) workforceWarnings.push(
        review
          ? {
              code: review.match.warningCode,
              message: review.match.matchReasonKo,
              workTradeRaw: item.trade,
              outputTradeCandidates: evaluated
                .filter((value) => value.group === group && value.match.requiresReview)
                .map((value) => value.output.trade),
            }
          : {
              code: "WORK_WITHOUT_WORKFORCE",
              message: `${canonical.baseTradeRaw} 작업은 있으나 연결된 출력인원이 없습니다.`,
              workTradeRaw: item.trade,
            },
      );
      if (!ambiguousGroups.has(key)) tradeMatch = review
        ? {
            ...review.match,
            sourceOutputCell: review.output.sourceCellRange || null,
            sourceWorkCell: item.sourceCellRange || null,
            workDescriptionRaw: item.rawText || item.description || null,
          }
        : null;
    }

    return {
      ...item,
      trade: item.trade,
      workTradeRaw: item.trade,
      workDescriptionRaw: item.rawText || item.description,
      plannedWorkforce: first && assignment ? assignment.output.plannedWorkforce : null,
      workDescriptionSource: "ORIGINAL_WORK_PLAN",
      isFallbackWorkItem: false,
      workforceApplied: Boolean(first && assignment),
      tradeMatch,
      sourceWorkCell: item.sourceCellRange || null,
    };
  });

  for (const output of outputRows) {
    if (usedOutputs.has(output.index) || !Number.isFinite(output.plannedWorkforce)) continue;
    const explanationKo =
      "출력현황에는 인원이 있으나 금일 작업예정사항이 작성되지 않았습니다.";
    reconciledItems.push({
      description: "노코멘트",
      locationText: null,
      rawText: null,
      trade: output.trade,
      workTradeRaw: null,
      workDescriptionRaw: null,
      plannedWorkforce: output.plannedWorkforce,
      companyName: null,
      companyBreakdownAvailable: false,
      sourceSheetName: output.sourceSheetName,
      sourceRow: output.sourceRow,
      sourceCellRange: output.sourceCellRange,
      sourceOutputCell: output.sourceCellRange,
      rawValue: null,
      normalizedValue: "노코멘트",
      warningCode: "OUTPUT_WITHOUT_WORK",
      workDescriptionSource: "OUTPUT_WORKFORCE_FALLBACK",
      isFallbackWorkItem: true,
      workforceApplied: true,
      explanationKo,
      tradeMatch: {
        outputTradeRaw: output.trade,
        workTradeRaw: null,
        normalizedOutputTrade: output.canonical.baseTradeNormalized,
        normalizedWorkTrade: null,
        canonicalOutputTradeId: output.canonical.canonicalTradeId,
        canonicalWorkTradeId: null,
        matchType: "UNMATCHED",
        matched: false,
        requiresReview: false,
        confidence: "NONE",
        matchScore: null,
        matchReasonKo: explanationKo,
        matchReason: explanationKo,
        warningCode: "OUTPUT_WITHOUT_WORK",
        sharedKeywords: [],
        conflictReasons: [],
        rejectedReasons: [],
        evidence: [],
        sourceOutputCell: output.sourceCellRange || null,
        sourceWorkCell: null,
        workDescriptionRaw: null,
      },
    });
    workforceWarnings.push({
      code: "OUTPUT_WITHOUT_WORK",
      message: explanationKo,
      outputTradeRaw: output.trade,
    });
  }

  const employeeWorkforce = outputRows
    .filter(
      (row) => row.canonical.canonicalTradeId === "STAFF" && Number.isFinite(row.plannedWorkforce),
    )
    .reduce((sum, row) => sum + row.plannedWorkforce, 0);
  const tradeWorkforceTotal = outputRows
    .filter(
      (row) => row.canonical.canonicalTradeId !== "STAFF" && Number.isFinite(row.plannedWorkforce),
    )
    .reduce((sum, row) => sum + row.plannedWorkforce, 0);
  return {
    plannedWorkItems: reconciledItems,
    todayWorkforceTotal: employeeWorkforce + tradeWorkforceTotal,
    employeeWorkforce,
    tradeWorkforceTotal,
    workforceWarnings,
    assignmentCount: assignments.size,
  };
}
