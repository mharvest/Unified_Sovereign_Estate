import Document, { Html, Head, Main, NextScript, type DocumentContext, type DocumentInitialProps } from 'next/document';

type DocumentProps = DocumentInitialProps & {
  nonce?: string;
};

export default class HarvestDocument extends Document<DocumentProps> {
  static async getInitialProps(ctx: DocumentContext): Promise<DocumentProps> {
    const initialProps = await Document.getInitialProps(ctx);
    const headerValue = ctx.req?.headers?.['x-nonce'];
    const nonce = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    return { ...initialProps, nonce };
  }

  render() {
    const { nonce } = this.props;
    return (
      <Html>
        <Head />
        <body>
          <Main />
          <NextScript nonce={nonce} />
        </body>
      </Html>
    );
  }
}
