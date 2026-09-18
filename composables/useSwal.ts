import Swal from 'sweetalert2'

// Centralized SweetAlert2 preset so every call site gets the same
// token-driven look (see .app-swal-* in assets/css/main.css) instead of
// SweetAlert2's default styling, and so confirm/warning/error copy stays
// consistent without re-writing button labels in every page.
const baseMixin = Swal.mixin({
  buttonsStyling: false,
  reverseButtons: true,
  customClass: {
    popup: 'app-swal-popup',
    title: 'app-swal-title',
    htmlContainer: 'app-swal-html',
    actions: 'app-swal-actions',
    icon: 'app-swal-icon',
  },
})

function confirmMixin(confirmClass: string) {
  return baseMixin.mixin({
    customClass: {
      popup: 'app-swal-popup',
      title: 'app-swal-title',
      htmlContainer: 'app-swal-html',
      actions: 'app-swal-actions',
      icon: 'app-swal-icon',
      confirmButton: `app-swal-btn ${confirmClass}`,
      cancelButton: 'app-swal-btn app-swal-btn-cancel',
    },
  })
}

const primaryConfirmMixin = confirmMixin('app-swal-btn-primary')
const dangerConfirmMixin = confirmMixin('app-swal-btn-danger')

export function useSwal() {
  function confirmDelete(itemLabel?: string) {
    return dangerConfirmMixin
      .fire({
        icon: 'warning',
        title: 'Hapus Data?',
        html: itemLabel ? `<strong>${itemLabel}</strong> akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.` : 'Tindakan ini tidak bisa dibatalkan.',
        showCancelButton: true,
        confirmButtonText: 'Ya, Hapus',
        cancelButtonText: 'Batal',
      })
      .then((r) => r.isConfirmed)
  }

  function confirmApprove(message: string) {
    return primaryConfirmMixin
      .fire({
        icon: 'question',
        title: 'Approve Dokumen?',
        html: message,
        showCancelButton: true,
        confirmButtonText: 'Ya, Approve',
        cancelButtonText: 'Batal',
      })
      .then((r) => r.isConfirmed)
  }

  function confirmReject(message: string) {
    return dangerConfirmMixin
      .fire({
        icon: 'warning',
        title: 'Reject Dokumen?',
        html: message,
        showCancelButton: true,
        confirmButtonText: 'Ya, Reject',
        cancelButtonText: 'Batal',
      })
      .then((r) => r.isConfirmed)
  }

  // Generic confirm for actions that don't fit the delete/approve/reject
  // shorthands above (e.g. submit-for-approval, cancel document).
  function confirmAction(opts: { title: string; message: string; confirmText?: string; variant?: 'primary' | 'danger' }) {
    const mixin = opts.variant === 'danger' ? dangerConfirmMixin : primaryConfirmMixin
    return mixin
      .fire({
        icon: opts.variant === 'danger' ? 'warning' : 'question',
        title: opts.title,
        html: opts.message,
        showCancelButton: true,
        confirmButtonText: opts.confirmText ?? 'Ya, Lanjutkan',
        cancelButtonText: 'Batal',
      })
      .then((r) => r.isConfirmed)
  }

  function confirmLogout() {
    return primaryConfirmMixin
      .fire({
        icon: 'question',
        title: 'Logout?',
        html: 'Anda akan keluar dari sesi ini.',
        showCancelButton: true,
        confirmButtonText: 'Ya, Logout',
        cancelButtonText: 'Batal',
      })
      .then((r) => r.isConfirmed)
  }

  // Info the user must acknowledge before a consequential action (e.g. "PO
  // ini akan trigger approval workflow") — not a yes/no gate, just a single
  // OK button, so it doesn't block the flow like a confirm dialog would.
  function infoBefore(title: string, message: string) {
    return baseMixin.fire({
      icon: 'info',
      title,
      html: message,
      confirmButtonText: 'Mengerti',
      customClass: {
        popup: 'app-swal-popup',
        title: 'app-swal-title',
        htmlContainer: 'app-swal-html',
        actions: 'app-swal-actions',
        icon: 'app-swal-icon',
        confirmButton: 'app-swal-btn app-swal-btn-primary',
      },
    })
  }

  // Warning/error that needs explicit acknowledgement rather than a toast
  // that can be missed (e.g. "Stock tidak cukup") — single OK button.
  function warningAck(message: string, title = 'Perhatian') {
    return baseMixin.fire({
      icon: 'warning',
      title,
      html: message,
      confirmButtonText: 'OK',
      customClass: {
        popup: 'app-swal-popup',
        title: 'app-swal-title',
        htmlContainer: 'app-swal-html',
        actions: 'app-swal-actions',
        icon: 'app-swal-icon',
        confirmButton: 'app-swal-btn app-swal-btn-primary',
      },
    })
  }

  function criticalError(message: string, title = 'Gagal') {
    return baseMixin.fire({
      icon: 'error',
      title,
      html: message,
      confirmButtonText: 'OK',
      customClass: {
        popup: 'app-swal-popup',
        title: 'app-swal-title',
        htmlContainer: 'app-swal-html',
        actions: 'app-swal-actions',
        icon: 'app-swal-icon',
        confirmButton: 'app-swal-btn app-swal-btn-danger',
      },
    })
  }

  return { confirmDelete, confirmApprove, confirmReject, confirmAction, confirmLogout, infoBefore, warningAck, criticalError }
}
