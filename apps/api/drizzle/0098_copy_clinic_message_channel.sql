UPDATE "clinics"
SET "message_channel" = ("settings" -> 'notifications' ->> 'channel')::"notification_channel"
WHERE "settings" -> 'notifications' ->> 'channel' IN ('whatsapp', 'sms');
--> statement-breakpoint
UPDATE "clinics"
SET "settings" = jsonb_set("settings", '{notifications}', ("settings" -> 'notifications') - 'channel')
WHERE jsonb_typeof("settings" -> 'notifications') = 'object'
  AND "settings" -> 'notifications' ? 'channel';
