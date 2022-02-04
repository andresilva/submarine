import { ok, err, Result } from "neverthrow";
import fetch from "cross-fetch";
import { createTransport, Transporter } from "nodemailer";
import { Twilio } from "twilio";
import { NotificationsConfig, ServiceConfig } from "./config";
import { Event } from "./event-matcher";

export type NotificationClients = {
  twilio?: [Twilio, string];
  smtp?: [Transporter, string];
};

export async function createClients(
  config: ServiceConfig
): Promise<Result<NotificationClients, Error>> {
  let twilio: [Twilio, string] | undefined;
  if (config.twilio.account_sid && config.twilio.auth_token && config.twilio.from_number) {
    twilio = [
      new Twilio(config.twilio.account_sid, config.twilio.auth_token),
      config.twilio.from_number
    ];
  }

  let smtp: [Transporter, string] | undefined;
  if (config.smtp.host && config.smtp.user && config.smtp.password && config.smtp.from_email) {
    const transporter = createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.password
      }
    });

    smtp = [transporter, config.smtp.from_email];
  }

  return ok({ twilio, smtp });
}

export async function sendNotifications(
  clients: NotificationClients,
  config: NotificationsConfig,
  event: Event
): Promise<Result<void, Error[]>> {
  const notifications = [];
  const errors: Error[] = [];

  for (const http of config.http) {
    const notification = async () => {
      try {
        const response = await fetch(http.url, {
          method: "POST",
          body: JSON.stringify(event),
          headers: { "Content-Type": "application/json" }
        });

        if (!response.ok) {
          errors.push(
            new Error(`HTTP notification failed: ${response.status} - ${await response.text()}`)
          );
        }
      } catch (error) {
        errors.push(new Error(`HTTP notification failed: ${(error as Error).message}`));
      }
    };

    notifications.push(notification());
  }

  if (clients.smtp) {
    for (const email of config.email) {
      const notification = clients.smtp[0]
        .sendMail({
          from: clients.smtp[1],
          to: email.email,
          subject: "submarine notification",
          text: JSON.stringify(event)
        })
        .catch((error) => errors.push(new Error(`Email notification failed: ${error.message}`)));

      notifications.push(notification);
    }
  }

  if (clients.twilio) {
    for (const sms of config.sms) {
      const notification = clients.twilio[0].messages
        .create({
          from: clients.twilio[1],
          to: sms.number,
          body: JSON.stringify(event)
        })
        .catch((error) => errors.push(new Error(`SMS notification failed: ${error.message}`)));

      notifications.push(notification);
    }
  }

  await Promise.all(notifications);

  if (errors.length === 0) {
    return ok(undefined);
  }

  return err(errors);
}
