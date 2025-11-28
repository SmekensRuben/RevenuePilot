import React from "react";
import Modal from "components/shared/Modal";

export default function ProgressModal({ open, progress, text, doneText, onClose }) {
  const canClose = progress >= 100;
  return (
    <Modal open={open} onClose={canClose ? onClose : () => {}} title="Import voortgang">
      <div className="space-y-4 text-center">
        <div className="w-full bg-gray-200 rounded h-3">
          <div className="bg-marriott h-full rounded" style={{ width: `${progress}%` }}></div>
        </div>
        <p>{canClose ? doneText : text}</p>
        {canClose && (
          <button
            onClick={onClose}
            className="bg-marriott text-white px-4 py-2 rounded-lg hover:bg-marriott-dark"
          >
            Sluiten
          </button>
        )}
      </div>
    </Modal>
  );
}
