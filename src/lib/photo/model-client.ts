import type { Plane } from './effects';
export interface ModelProgress { text: string; progress?: number; }
export interface ModelOutput { backend?: 'CPU' | 'GPU'; person?: Plane; depth?: Plane; }
type Pending = { resolve: (result: ModelOutput) => void; reject: (cause: Error) => void; progress: (value: ModelProgress) => void; timer: ReturnType<typeof setTimeout> };
export class ModelClient {
  private worker: Worker | undefined;
  private next = 0;
  private pending = new Map<number, Pending>();
  constructor(private create: () => Worker) {}
  run(payload: object, transfers: Transferable[], progress: (value: ModelProgress) => void): Promise<ModelOutput> {
    if (!this.worker) {
      this.worker = this.create();
      this.worker.onmessage = ({ data }) => {
        const task = this.pending.get(data.id); if (!task) return;
        if (data.kind === 'progress') { task.progress(data); return; }
        clearTimeout(task.timer); this.pending.delete(data.id);
        if (data.kind === 'error') task.reject(new Error(data.error)); else task.resolve(data);
      };
      this.worker.onerror = () => this.dispose('모델 실행에 실패했습니다. 다시 시도해주세요.');
    }
    const id = ++this.next;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.dispose('모델 준비 시간이초과되었습니다. 연결을 확인하고 다시 시도해주세요.'), 180_000);
      this.pending.set(id, { resolve, reject, progress, timer });
      try { this.worker!.postMessage({ ...payload, id }, transfers); } catch (cause) { clearTimeout(timer); this.pending.delete(id); reject(cause); }
    });
  }
  get busy() { return this.pending.size > 0; }
  dispose(message = '모델 작업이 취소되었습니다.') {
    this.worker?.terminate(); this.worker = undefined;
    for (const task of this.pending.values()) { clearTimeout(task.timer); task.reject(new Error(message)); }
    this.pending.clear();
  }
}
