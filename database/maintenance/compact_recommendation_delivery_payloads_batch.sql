-- Run repeatedly only after migration 125 and its compatible Worker are live.
-- Each invocation clears at most 500 recipient copies. No delivery row is deleted.
UPDATE recommendation_deliveries
SET subject = NULL,
    bodyText = NULL,
    bodyHtml = NULL,
    metadataJson = NULL,
    updatedAt = updatedAt
WHERE id IN (
  SELECT delivery.id
  FROM recommendation_deliveries delivery
  INNER JOIN recommendation_delivery_payloads payload
    ON payload.eventKey = delivery.eventKey
   AND payload.language = delivery.language
  WHERE delivery.subject IS NOT NULL
     OR delivery.bodyText IS NOT NULL
     OR delivery.bodyHtml IS NOT NULL
     OR delivery.metadataJson IS NOT NULL
  ORDER BY delivery.id
  LIMIT 500
);
