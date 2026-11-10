import { useState } from "react";
import { ArrowRight, Camera, Eye, EyeOff } from "lucide-react";
import { api } from "../api";
import type { User } from "../types";
import { Mark, Modal } from "./UI";
export function Auth({
  mode,
  onMode,
  onClose,
  onSuccess,
}: {
  mode: "login" | "register";
  onMode: (v: "login" | "register") => void;
  onClose: () => void;
  onSuccess: (u: User) => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [avatar, setAvatar] = useState("");
  const [show, setShow] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const data = new FormData(e.currentTarget);
    const body = Object.fromEntries(data);
    if (mode === "register" && !avatar) {
      setError("Добавьте фото профиля в формате JPG или PNG");
      return;
    }
    setBusy(true);
    try {
      const u = await api<User>("/auth/" + mode, {
        method: "POST",
        body: JSON.stringify(mode === "register" ? { ...body, avatar } : body),
      });
      onSuccess(u);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(file?: File) {
    if (!file) return;
    if (
      !["image/jpeg", "image/png"].includes(file.type) ||
      file.size > 4 * 1024 * 1024
    ) {
      setError("Выберите JPG или PNG размером до 4 МБ");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAvatar(String(reader.result));
      setError("");
    };
    reader.readAsDataURL(file);
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={mode === "register" ? "Присоединиться к Mood" : "Вход"}
    >
      <div className="auth-mark">
        <Mark />
      </div>
      <form onSubmit={submit} className="form">
        {mode === "register" && (
          <>
            <label className="avatar-upload">
              {avatar ? (
                <img src={avatar} alt="Ваше фото" />
              ) : (
                <Camera size={24} />
              )}
              <input
                type="file"
                accept="image/jpeg,image/png"
                onChange={(e) => upload(e.target.files?.[0])}
              />
              <span>
                Добавить фото <small>JPG или PNG, до 4 МБ</small>
              </span>
            </label>
            <label>
              Фамилия и имя
              <input
                name="full_name"
                required
                minLength={3}
                maxLength={100}
                placeholder="Серикова Айгерим"
                autoComplete="name"
              />
            </label>
            <label>
              Никнейм
              <span className="input-prefix">
                <span>@</span>
                <input
                  name="username"
                  required
                  minLength={3}
                  maxLength={24}
                  pattern="[a-zA-Z0-9_]{3,24}"
                  placeholder="aigerim.reads"
                  autoComplete="username"
                />
              </span>
              <small>Латинские буквы, цифры и _</small>
            </label>
          </>
        )}
        <label>
          Gmail
          <input
            name="email"
            type="email"
            required
            maxLength={254}
            placeholder="you@gmail.com"
            autoComplete="email"
          />
        </label>
        <label>
          Пароль
          <span className="password-field">
            <input
              name="password"
              type={show ? "text" : "password"}
              required
              minLength={mode === "register" ? 10 : 1}
              maxLength={256}
              placeholder={
                mode === "register" ? "Не менее 10 символов" : "Ваш пароль"
              }
              autoComplete={
                mode === "register" ? "new-password" : "current-password"
              }
            />
            <button
              type="button"
              className="icon-button"
              onClick={() => setShow(!show)}
              aria-label={show ? "Скрыть пароль" : "Показать пароль"}
            >
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary full" disabled={busy}>
          {busy
            ? "Подождите…"
            : mode === "register"
              ? "Создать аккаунт"
              : "Войти"}
          <ArrowRight size={17} />
        </button>
        <p className="auth-switch">
          {mode === "register" ? "Уже с нами?" : "Пока нет аккаунта?"}{" "}
          <button
            type="button"
            onClick={() => {
              setError("");
              onMode(mode === "register" ? "login" : "register");
            }}
          >
            {mode === "register" ? "Войти" : "Присоединиться"}
          </button>
        </p>
      </form>
    </Modal>
  );
}
