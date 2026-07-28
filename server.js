const express = require('express');
const path = require('path');
const fs = require('fs');
const Stripe = require('stripe');
const { Resend } = require('resend');

const app = express();
const port = process.env.PORT || 3000;

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/api/ebook', (req, res) => {
  const filePath = path.join(__dirname, 'Hidden_Linux.pdf');
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      return res.status(404).json({ error: 'PDF not found' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="Hidden_Linux.pdf"');
    fs.createReadStream(filePath).pipe(res);
  });
});

app.post('/api/checkout', async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe is not configured' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Hidden Linux Ebook',
            description: 'Instant PDF delivery via email'
          },
          unit_amount: 50
        },
        quantity: 1
      }],
      success_url: `${req.protocol}://${req.get('host')}/?checkout=success`,
      cancel_url: `${req.protocol}://${req.get('host')}/?checkout=cancelled`,
      customer_email: req.body?.email || undefined,
      metadata: {
        ebook: 'Hidden_Linux.pdf'
      }
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Checkout session error:', error);
    res.status(500).json({ error: 'Unable to create checkout session' });
  }
});

app.post('/api/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !resend) {
    return res.status(200).send('Webhook skipped');
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    console.error('Webhook signature error:', error);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_details?.email || session.customer_email;

    if (email) {
      try {
        await resend.emails.send({
          from: 'Hidden Linux <orders@hiddenlinux.com>',
          to: [email],
          subject: 'Your Hidden Linux ebook is ready',
          html: '<p>Thank you for your purchase. Your full ebook PDF is attached below.</p>',
          attachments: [{
            filename: 'Hidden_Linux.pdf',
            content: fs.readFileSync(path.join(__dirname, 'Hidden_Linux.pdf'))
          }]
        });
      } catch (emailError) {
        console.error('Resend delivery error:', emailError);
      }
    }
  }

  res.status(200).send('Received');
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
