type Awaitable<T> = T | PromiseLike<T>;

export type FormattingStatusReporter = {
  showNormal(): void;
  showError(): void;
};

export async function withFormattingStatus<T>(
  next: () => Awaitable<T | null | undefined>,
  status: FormattingStatusReporter,
): Promise<T | null | undefined> {
  try {
    const result = await Promise.resolve(next());
    if (result != null) {
      status.showNormal();
    }
    return result;
  } catch (error) {
    if (error instanceof Error && error.name === "Canceled") {
      throw error;
    }
    status.showError();
    throw error;
  }
}
