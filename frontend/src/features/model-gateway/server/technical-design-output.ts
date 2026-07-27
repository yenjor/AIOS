import type { ArtifactSection } from "@/features/artifact/model";

export const TECHNICAL_DESIGN_SECTION_TITLES = [
  "目标理解",
  "范围与不做事项",
  "影响模块与文件",
  "技术决策",
  "风险",
  "测试建议",
  "回退考虑",
  "知识库引用",
] as const;

export const TECHNICAL_DESIGN_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["sections"],
  properties: {
    sections: {
      type: "array",
      minItems: 8,
      maxItems: 8,
      prefixItems: TECHNICAL_DESIGN_SECTION_TITLES.map((title) => ({
        type: "object",
        additionalProperties: false,
        required: ["title", "paragraphs"],
        properties: {
          title: { const: title },
          paragraphs: {
            type: "array",
            minItems: 1,
            maxItems: 8,
            items: { type: "string", minLength: 8, maxLength: 1_200 },
          },
        },
      })),
      items: false,
    },
  },
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const keys = Object.keys(value).sort();
  return (
    keys.length === expected.length &&
    keys.every((key, index) => key === [...expected].sort()[index])
  );
}

function normalizedParagraph(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\r\n/g, "\n").trim();
  if (
    normalized.length < 8 ||
    normalized.length > 1_200 ||
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(normalized)
  ) {
    return undefined;
  }
  return normalized;
}

export function parseTechnicalDesignSections(content: string): ArtifactSection[] {
  if (content.length === 0 || content.length > 96_000) {
    throw new Error("Model output is empty or exceeds the bounded output size.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Model output is not valid JSON.");
  }
  if (
    !isRecord(parsed) ||
    !hasExactKeys(parsed, ["sections"]) ||
    !Array.isArray(parsed.sections) ||
    parsed.sections.length !== TECHNICAL_DESIGN_SECTION_TITLES.length
  ) {
    throw new Error("Model output does not match the technical design schema.");
  }

  return parsed.sections.map((candidate, index) => {
    if (
      !isRecord(candidate) ||
      !hasExactKeys(candidate, ["title", "paragraphs"]) ||
      candidate.title !== TECHNICAL_DESIGN_SECTION_TITLES[index] ||
      !Array.isArray(candidate.paragraphs) ||
      candidate.paragraphs.length < 1 ||
      candidate.paragraphs.length > 8
    ) {
      throw new Error(
        `Model output section ${index + 1} violates the fixed Artifact contract.`,
      );
    }
    const paragraphs = candidate.paragraphs.map(normalizedParagraph);
    if (paragraphs.some((paragraph) => paragraph === undefined)) {
      throw new Error(
        `Model output section ${index + 1} contains an invalid paragraph.`,
      );
    }
    return {
      title: TECHNICAL_DESIGN_SECTION_TITLES[index],
      paragraphs: paragraphs as string[],
    };
  });
}
