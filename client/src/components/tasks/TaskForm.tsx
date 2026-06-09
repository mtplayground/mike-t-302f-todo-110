import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";

import type { Task, TaskFormInput, TaskPriority } from "../../api/tasks.js";

const priorities: ReadonlyArray<{ readonly label: string; readonly value: TaskPriority }> = [
  { label: "Low", value: "LOW" },
  { label: "Medium", value: "MEDIUM" },
  { label: "High", value: "HIGH" },
];

interface TaskFormValues {
  readonly description: string;
  readonly dueDate: string;
  readonly priority: TaskPriority;
  readonly title: string;
}

const emptyValues: TaskFormValues = {
  description: "",
  dueDate: "",
  priority: "MEDIUM",
  title: "",
};

export function TaskForm({
  error,
  isSubmitting,
  onCancelEdit,
  onSubmit,
  task,
}: {
  readonly error: string | null;
  readonly isSubmitting: boolean;
  readonly onCancelEdit: () => void;
  readonly onSubmit: (input: TaskFormInput) => Promise<void>;
  readonly task: Task | null;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const dueDateId = useId();
  const imageId = useId();
  const priorityId = useId();
  const removeImageId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState<TaskFormValues>(emptyValues);
  const [clientError, setClientError] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [selectedImagePreviewUrl, setSelectedImagePreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedImage || typeof URL.createObjectURL !== "function") {
      setSelectedImagePreviewUrl(null);
      return;
    }

    const previewUrl = URL.createObjectURL(selectedImage);
    setSelectedImagePreviewUrl(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [selectedImage]);

  useEffect(() => {
    setClientError(null);
    setRemoveImage(false);
    setSelectedImage(null);
    clearFileInput(fileInputRef.current);

    if (!task) {
      setValues(emptyValues);
      return;
    }

    setValues({
      description: task.description ?? "",
      dueDate: task.dueDate ?? "",
      priority: task.priority,
      title: task.title,
    });
  }, [task]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = values.title.trim();

    if (!title) {
      setClientError("Title is required");
      return;
    }

    setClientError(null);
    try {
      await onSubmit({
        description: values.description.trim() || null,
        dueDate: values.dueDate || null,
        ...(selectedImage ? { imageFile: selectedImage } : {}),
        priority: values.priority,
        ...(task && removeImage ? { removeImage: true } : {}),
        title,
      });
    } catch {
      return;
    }

    if (!task) {
      setValues(emptyValues);
      setSelectedImage(null);
      clearFileInput(fileInputRef.current);
    }
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const image = event.target.files?.[0] ?? null;

    setSelectedImage(image);

    if (image) {
      setRemoveImage(false);
    }
  }

  function handleRemoveImageChange(checked: boolean) {
    setRemoveImage(checked);

    if (checked) {
      setSelectedImage(null);
      clearFileInput(fileInputRef.current);
    }
  }

  const previewImageUrl =
    selectedImagePreviewUrl ?? (!removeImage && task?.imageUrl ? task.imageUrl : null);

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{task ? "Edit task" : "New task"}</h2>
        {task ? (
          <button
            className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-50"
            onClick={onCancelEdit}
            type="button"
          >
            Cancel
          </button>
        ) : null}
      </div>

      <label className="block text-sm font-medium text-zinc-700" htmlFor={titleId}>
        Title
      </label>
      <input
        className="mt-1 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        id={titleId}
        maxLength={200}
        onChange={(event) => setValues({ ...values, title: event.target.value })}
        required
        type="text"
        value={values.title}
      />

      <label className="block text-sm font-medium text-zinc-700" htmlFor={descriptionId}>
        Description
      </label>
      <textarea
        className="mt-1 min-h-24 w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        id={descriptionId}
        maxLength={5000}
        onChange={(event) => setValues({ ...values, description: event.target.value })}
        value={values.description}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        <div>
          <label className="block text-sm font-medium text-zinc-700" htmlFor={dueDateId}>
            Due date
          </label>
          <input
            className="mt-1 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            id={dueDateId}
            onChange={(event) => setValues({ ...values, dueDate: event.target.value })}
            type="date"
            value={values.dueDate}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700" htmlFor={priorityId}>
            Priority
          </label>
          <select
            className="mt-1 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            id={priorityId}
            onChange={(event) =>
              setValues({ ...values, priority: event.target.value as TaskPriority })
            }
            value={values.priority}
          >
            {priorities.map((priority) => (
              <option key={priority.value} value={priority.value}>
                {priority.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700" htmlFor={imageId}>
          Image
        </label>
        <input
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="mt-1 block w-full text-sm text-zinc-700 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200"
          id={imageId}
          onChange={handleImageChange}
          ref={fileInputRef}
          type="file"
        />
        {previewImageUrl ? (
          <img
            alt={selectedImage ? "Selected task image preview" : "Current task image"}
            className="mt-3 h-32 w-full rounded-md border border-zinc-200 object-cover"
            src={previewImageUrl}
          />
        ) : null}
        {task?.imageUrl ? (
          <label
            className="mt-3 flex items-center gap-2 text-sm font-medium text-zinc-700"
            htmlFor={removeImageId}
          >
            <input
              checked={removeImage}
              className="h-4 w-4 rounded border-zinc-300 text-emerald-600 accent-emerald-600"
              id={removeImageId}
              onChange={(event) => handleRemoveImageChange(event.target.checked)}
              type="checkbox"
            />
            Remove current image
          </label>
        ) : null}
      </div>

      {clientError || error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {clientError ?? error}
        </div>
      ) : null}

      <button
        className="h-10 w-full rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Saving" : task ? "Save changes" : "Add task"}
      </button>
    </form>
  );
}

function clearFileInput(input: HTMLInputElement | null): void {
  if (input) {
    input.value = "";
  }
}
