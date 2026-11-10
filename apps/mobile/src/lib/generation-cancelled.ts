export class GenerationCancelledError extends Error {
  constructor() {
    super("生成已取消，正式计划没有变化，可重新生成");
  }
}
