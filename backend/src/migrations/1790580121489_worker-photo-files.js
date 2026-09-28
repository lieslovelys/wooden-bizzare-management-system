// PRD.md C.2 "Storage discipline": worker photos move off unbounded base64 in the `photo` text
// column onto real files on disk (see utils/photoStorage.js). This adds the column that stores
// just the filename; `photo` itself stays for this pass (see ARCHITECTURE_REVIEW.md item 21's
// "Deferred" note — it can't be dropped until scripts/backfillPhotos.js has run everywhere,
// which the Docker entrypoint does automatically but a bare local dev DB has to run by hand).
export const shorthands = undefined;

export const up = (pgm) => {
  pgm.addColumn('worker_details', {
    photo_path: {
      type: 'varchar(64)',
    },
  });
};

export const down = (pgm) => {
  pgm.dropColumn('worker_details', 'photo_path');
};
