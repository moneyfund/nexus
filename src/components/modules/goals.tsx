"use client";
import { useState } from "react";
import Link from "next/link";
import { Plus, Check, ArrowUpRight } from "lucide-react";
import { useNexus } from "../nexus-provider";
import {
  ModuleFrame,
  Button,
  Label,
  ProgressRing,
  Modal,
  Empty,
} from "../ui/primitives";
import { entity } from "@/domain/seed";
export function GoalsView() {
  const n = useNexus();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [milestones, setMilestones] = useState("");
  return (
    <ModuleFrame
      eyebrow="Direction layer / 06"
      title="Goals"
      description="La dirección que hace que las tareas importen."
      action={
        <Button onClick={() => setOpen(true)}>
          <Plus size={16} />
          Nueva meta
        </Button>
      }
    >
      <div className="goal-list">
        {n.data.goals.map((g, i) => {
          const progress = g.milestones.length
            ? Math.round(
                (g.milestones.filter((m) => m.completed).length /
                  g.milestones.length) *
                  100,
              )
            : 0;
          return (
            <section key={g.id} className="goal-section">
              <span className="goal-number">0{i + 1}</span>
              <div>
                <Label>
                  HORIZON / {g.targetDate}
                  {g.source === "demo" ? " · DEMO" : ""}
                </Label>
                <h2>{g.title}</h2>
                <div className="goal-milestones">
                  {g.milestones.map((m) => (
                    <button
                      key={m.id}
                      onClick={() =>
                        n.run(() => n.actions.toggleGoal(g.id, m.id))
                      }
                      aria-pressed={m.completed}
                    >
                      <span
                        className={
                          "task-check " + (m.completed ? "checked" : "")
                        }
                      >
                        {m.completed && <Check size={12} />}
                      </span>
                      {m.title}
                    </button>
                  ))}
                </div>
                <div className="row wrap">
                  {g.projectIds.map((id) => (
                    <Link
                      key={id}
                      href={"/projects/" + id}
                      className="inline-arrow"
                    >
                      {n.projects.find((p) => p.id === id)?.name}
                      <ArrowUpRight size={14} />
                    </Link>
                  ))}
                </div>
              </div>
              <ProgressRing value={progress} size={120} caption="MILESTONES" />
            </section>
          );
        })}
      </div>
      {!n.data.goals.length && (
        <Empty
          title="Elige una dirección."
          text="Define el resultado que quieres construir."
          onAction={() => setOpen(true)}
        />
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Una dirección nueva"
      >
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            const saved = n.update((w) => {
              const goalId = crypto.randomUUID();
              w.goals.push({
                ...entity(goalId, "user", w.user.id),
                title: title.trim(),
                targetDate: target,
                projectIds: [],
                milestones: milestones
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((text) => ({
                    ...entity(crypto.randomUUID(), "user", w.user.id),
                    goalId,
                    title: text,
                    completed: false,
                  })),
              });
            });
            if (!saved) return;
            setOpen(false);
            setTitle("");
            setMilestones("");
          }}
        >
          <label className="field">
            Meta
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="field">
            Fecha objetivo
            <input
              type="date"
              required
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </label>
          <label className="field">
            Hitos · uno por línea
            <textarea
              required
              value={milestones}
              onChange={(e) => setMilestones(e.target.value)}
              placeholder="Preparar propuesta&#10;Validar&#10;Lanzar"
            />
          </label>
          <Button type="submit">Crear meta</Button>
        </form>
      </Modal>
    </ModuleFrame>
  );
}
