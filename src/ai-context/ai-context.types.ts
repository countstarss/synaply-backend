import { AiSurfaceType } from '../../prisma/generated/prisma/client';

export { AiSurfaceType };

/**
 * 浓缩 surface 摘要：每个 pinned 对象 ≤ 500 tokens 的简短描述。
 *
 * Next.js runtime 每次调用模型前都会自动注入这个，让模型不调用任何工具就能
 * 知道"在讨论的是哪些对象"。深度信息靠 read tools 按需拉取。
 */
export interface AiSurfaceSummary {
  surfaceType: AiSurfaceType;
  surfaceId: string;
  title: string;
  status?: string;
  ownerLabel?: string;
  recentActivity?: string;
  /**
   * 最终塞给模型的纯文本 chunk（已经按 500 tokens 上限截断）。
   */
  text: string;
}
