// Lightweight toast helper built on SweetAlert2 (already a dependency).
// Used by the AI hooks/components which originally depended on `sonner`.
import Swal from 'sweetalert2'

const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  didOpen: (el) => {
    el.addEventListener('mouseenter', Swal.stopTimer)
    el.addEventListener('mouseleave', Swal.resumeTimer)
  },
})

export const toast = {
  success: (title) => Toast.fire({ icon: 'success', title }),
  error: (title) => Toast.fire({ icon: 'error', title }),
  info: (title) => Toast.fire({ icon: 'info', title }),
}

export default toast
