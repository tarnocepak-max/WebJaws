import { Router, Response } from 'express';
import crypto from 'crypto';
import { webJawsStore, TicketMessage } from '../db/store.js';
import { AuthenticatedRequest, requireAuth, getClientIp } from '../auth/auth.js';

export const contactRouter = Router();

contactRouter.use(requireAuth);

// GET /api/contact/messages - List tickets and messages
contactRouter.get('/messages', (req: AuthenticatedRequest, res: Response) => {
  const { wo_number, unread_only } = req.query;
  const user = req.user!;

  let messages = [...webJawsStore.ticketMessages];

  if (wo_number && typeof wo_number === 'string') {
    messages = messages.filter((m) => m.wo_number && m.wo_number.toLowerCase() === wo_number.toLowerCase());
  }

  if (unread_only === 'true') {
    messages = messages.filter((m) => !m.is_read && m.sender_id !== user.id);
  }

  // Calculate unread count for current user
  const unreadCount = webJawsStore.ticketMessages.filter((m) => !m.is_read && m.sender_id !== user.id).length;

  // Group by WO Number for ticket threads
  const threadsMap: Record<string, { wo_number: string; latestMessage: TicketMessage; count: number; unread: boolean }> = {};

  webJawsStore.ticketMessages.forEach((m) => {
    const key = m.wo_number || 'GENERAL';
    if (!threadsMap[key]) {
      threadsMap[key] = {
        wo_number: key,
        latestMessage: m,
        count: 1,
        unread: !m.is_read && m.sender_id !== user.id,
      };
    } else {
      threadsMap[key].count++;
      if (new Date(m.created_at) > new Date(threadsMap[key].latestMessage.created_at)) {
        threadsMap[key].latestMessage = m;
      }
      if (!m.is_read && m.sender_id !== user.id) {
        threadsMap[key].unread = true;
      }
    }
  });

  return res.json({
    success: true,
    total: messages.length,
    unreadCount,
    threads: Object.values(threadsMap),
    messages,
  });
});

// POST /api/contact/messages - Send new LiveChat / Ticket message
contactRouter.post('/messages', (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { wo_number, message, attachment_url, attachment_name } = req.body;

  if (!message || message.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Message text cannot be empty' });
  }

  let wo_id: string | undefined;
  if (wo_number) {
    const wo = webJawsStore.workOrders.find((w) => w.wo_number === wo_number.trim());
    if (wo) wo_id = wo.id;
  }

  const newMessage: TicketMessage = {
    id: crypto.randomUUID(),
    wo_id,
    wo_number: wo_number ? wo_number.trim() : undefined,
    sender_id: user.id,
    sender_name: user.full_name,
    sender_role: user.role,
    message: message.trim(),
    attachment_url: attachment_url || undefined,
    attachment_name: attachment_name || undefined,
    is_read: false,
    created_at: new Date().toISOString(),
  };

  webJawsStore.ticketMessages.push(newMessage);

  webJawsStore.addAuditLog({
    user_id: user.id,
    user_name: user.full_name,
    role: user.role,
    activity: 'SEND_LIVECHAT_MESSAGE',
    module: 'Contact Center',
    record_id: newMessage.id,
    diff_data: { wo_number, hasAttachment: !!attachment_url },
    ip_address: getClientIp(req),
  });

  return res.status(201).json({
    success: true,
    message: 'Message sent successfully',
    chatMessage: newMessage,
  });
});

// PATCH /api/contact/messages/:id/read - Mark message as read
contactRouter.patch('/messages/:id/read', (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const msg = webJawsStore.ticketMessages.find((m) => m.id === id);

  if (!msg) {
    return res.status(404).json({ success: false, error: 'Message not found' });
  }

  msg.is_read = true;

  return res.json({
    success: true,
    message: 'Message marked as read',
  });
});
