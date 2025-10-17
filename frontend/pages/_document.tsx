import Document, { Html, Head, Main, NextScript } from 'next/document';

class UnifiedEstateDocument extends Document {
  render() {
    return (
      <Html className="bg-midnight">
        <Head />
        <body className="bg-midnight text-white">
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default UnifiedEstateDocument;
