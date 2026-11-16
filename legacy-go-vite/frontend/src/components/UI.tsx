import * as Dialog from "@radix-ui/react-dialog";
import { X, BookOpen, MoveUpRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { Book, User } from "../types";
export function Mark() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M9.463416464046453 32.49999999999999 6.954504629627046 30.58890799403758 13.735605953562418 19.891021092369613 6.981143874816038 9.448923810831246 9.493872744928037 7.4999999999999964 19.369258744190795 16.517062980454682Q20.324596457471877 17.32048447671993 20.781105810334008 18.118055196704578Q21.23761516319614 18.915625916689226 21.23761516319614 19.926864957130892Q21.23761516319614 20.83597852058893 20.863364303320502 21.63267932846576Q20.489113443444865 22.429380136342587 19.418298147772717 23.39373931892993ZM21.27129667122327 32.49999999999999 18.762384836803857 30.58890799403758 25.54348616073923 19.891021092369613 18.789024081992853 9.448923810831246 21.30175295210485 7.4999999999999964 31.17713895136761 16.517062980454682Q32.13247666464869 17.32048447671993 32.58898601751082 18.118055196704578Q33.045495370372954 18.915625916689226 33.045495370372954 19.926864957130892Q33.045495370372954 20.83597852058893 32.67124451049732 21.63267932846576Q32.29699365062168 22.429380136342587 31.226178354949532 23.39373931892993Z"
        fill="currentColor"
      />
    </svg>
  );
}
export function Avatar({
  user,
  size = "normal",
}: {
  user: Pick<User, "full_name" | "avatar" | "username">;
  size?: "small" | "normal" | "large";
}) {
  const letters = user.full_name
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("");
  const hue = [...user.username].reduce((a, c) => a + c.charCodeAt(0), 0) % 5;
  return (
    <span className={`avatar ${size} avatar-${hue}`}>
      {user.avatar ? <img src={user.avatar} alt={user.full_name} /> : letters}
    </span>
  );
}
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          className={`modal ${wide ? "modal-wide" : ""}`}
          aria-describedby={description ? "modal-description" : undefined}
        >
          <div className="modal-heading">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close className="icon-button" aria-label="Закрыть">
              <X size={21} />
            </Dialog.Close>
          </div>
          {description && (
            <Dialog.Description
              id="modal-description"
              className="modal-description"
            >
              {description}
            </Dialog.Description>
          )}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function BookCover({
  book,
  small = false,
}: {
  book: Pick<Book, "title" | "author" | "color" | "cover">;
  small?: boolean;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  if (book.cover && !imgFailed)
    return (
      <div
        className={`book-cover book-cover-image ${small ? "cover-small" : ""}`}
      >
        <img
          src={book.cover}
          alt={`Обложка книги «${book.title}»`}
          loading="lazy"
          decoding="async"
          onError={() => setImgFailed(true)}
        />
      </div>
    );
  return (
    <div
      className={`book-cover ${small ? "cover-small" : ""}`}
      style={{ backgroundColor: book.color || "#31574b" }}
    >
      <div className="cover-ornament">
        <Mark />
      </div>
      <strong>{book.title}</strong>
      <span className="cover-author">{book.author}</span>
      <div className="cover-lines" />
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <BookOpen size={32} strokeWidth={1.2} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function TextLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <MoveUpRight size={14} />
    </button>
  );
}
