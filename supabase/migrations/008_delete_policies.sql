-- Delete policies
CREATE POLICY "members_delete_own" ON conversation_members
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "members_delete_admin" ON conversation_members
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM conversation_members cm
      WHERE cm.conversation_id = conversation_members.conversation_id
      AND cm.user_id = auth.uid() AND cm.role = 'admin')
  );

-- Update policy for admin to change roles
CREATE POLICY "members_update_admin" ON conversation_members
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM conversation_members cm
      WHERE cm.conversation_id = conversation_members.conversation_id
      AND cm.user_id = auth.uid() AND cm.role = 'admin')
  );

CREATE POLICY "messages_delete_own" ON messages
  FOR DELETE TO authenticated USING (sender_id = auth.uid());

CREATE POLICY "messages_delete_admin" ON messages
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM conversation_members cm
      WHERE cm.conversation_id = messages.conversation_id
      AND cm.user_id = auth.uid() AND cm.role = 'admin')
  );

CREATE POLICY "conversations_delete_admin" ON conversations
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM conversation_members cm
      WHERE cm.conversation_id = conversations.id
      AND cm.user_id = auth.uid() AND cm.role = 'admin')
  );

-- Conversations update for pinned message etc.
CREATE POLICY "conversations_update_member" ON conversations
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM conversation_members cm
      WHERE cm.conversation_id = conversations.id
      AND cm.user_id = auth.uid())
  );
