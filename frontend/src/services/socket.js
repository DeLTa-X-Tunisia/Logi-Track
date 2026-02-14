import { io } from 'socket.io-client';

// Utiliser l'hostname actuel du navigateur pour supporter l'accès réseau
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
  }

  connect() {
    if (this.socket?.connected) return;

    // Déconnecter proprement si une instance existe mais n'est pas connectée
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
    }

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });

    this.socket.on('connect', () => {
      console.log('🔌 Socket.io connecté:', this.socket.id);
      this.connected = true;
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Socket.io déconnecté');
      this.connected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('⚠️ Erreur de connexion Socket.io:', error);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  // Rejoindre une room d'étape de production
  joinEtape(etapeCode) {
    if (this.socket?.connected) {
      this.socket.emit('join_etape', etapeCode);
    }
  }

  // Quitter une room d'étape
  leaveEtape(etapeCode) {
    if (this.socket?.connected) {
      this.socket.emit('leave_etape', etapeCode);
    }
  }

  // Émettre une mise à jour de tube
  emitTubeUpdate(data) {
    if (this.socket?.connected) {
      this.socket.emit('tube_update', data);
    }
  }

  // Émettre une alerte
  emitAlert(data) {
    if (this.socket?.connected) {
      this.socket.emit('alert', data);
    }
  }

  // Écouter les mises à jour de tubes
  onTubeUpdated(callback) {
    if (this.socket) {
      this.socket.on('tube_updated', callback);
    }
  }

  // Écouter les nouvelles alertes
  onNewAlert(callback) {
    if (this.socket) {
      this.socket.on('new_alert', callback);
    }
  }

  // Écouter les notifications (décisions finales, etc.)
  onNotification(callback) {
    if (this.socket) {
      this.socket.on('notification', callback);
    }
  }

  // Supprimer un écouteur
  off(event) {
    if (this.socket) {
      this.socket.off(event);
    }
  }
}

export default new SocketService();
