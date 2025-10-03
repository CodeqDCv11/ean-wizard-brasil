import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Copy, Download, RotateCcw } from "lucide-react";

interface EanCode {
  code: string;
  baseCode: string;
}

const calculateEanCheckDigit = (code: string): string => {
  const digits = code.split('').map(Number);
  let sum = 0;
  
  for (let i = 0; i < 12; i++) {
    sum += digits[i] * (i % 2 === 0 ? 1 : 3);
  }
  
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit.toString();
};

const EanGenerator = () => {
  const [prefix, setPrefix] = useState<string>("789");
  const [cnpjDigits, setCnpjDigits] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("1");
  const [lastBaseCode, setLastBaseCode] = useState<string>("");
  const [generatedCodes, setGeneratedCodes] = useState<EanCode[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("lastEanBaseCode");
    if (saved) {
      setLastBaseCode(saved);
    }
  }, []);

  const generateEans = () => {
    if (cnpjDigits.length !== 5) {
      toast.error("Digite exatamente 5 dígitos do CNPJ");
      return;
    }

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1 || qty > 1000) {
      toast.error("Quantidade deve ser entre 1 e 1000");
      return;
    }

    const codes: EanCode[] = [];
    let startNumber = 0;

    if (lastBaseCode && lastBaseCode.startsWith(prefix + cnpjDigits)) {
      const lastFourDigits = lastBaseCode.slice(8, 12);
      startNumber = parseInt(lastFourDigits) + 1;
    }

    for (let i = 0; i < qty; i++) {
      const fourDigits = (startNumber + i).toString().padStart(4, '0');
      const baseCode = prefix + cnpjDigits + fourDigits;
      const checkDigit = calculateEanCheckDigit(baseCode);
      const fullCode = baseCode + checkDigit;
      
      codes.push({
        code: fullCode,
        baseCode: baseCode
      });
    }

    const lastGenerated = codes[codes.length - 1].baseCode;
    setLastBaseCode(lastGenerated);
    localStorage.setItem("lastEanBaseCode", lastGenerated);
    
    setGeneratedCodes(codes);
    toast.success(`${qty} código(s) EAN-13 gerado(s) com sucesso!`);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Código copiado!");
  };

  const copyAllCodes = () => {
    const allCodes = generatedCodes.map(c => c.code).join('\n');
    navigator.clipboard.writeText(allCodes);
    toast.success("Todos os códigos copiados!");
  };

  const downloadCodes = () => {
    const allCodes = generatedCodes.map(c => c.code).join('\n');
    const blob = new Blob([allCodes], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ean-codes-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Arquivo baixado!");
  };

  const resetLastCode = () => {
    setLastBaseCode("");
    localStorage.removeItem("lastEanBaseCode");
    toast.success("Último código resetado!");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center space-y-3">
          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Gerador de EAN-13
          </h1>
          <p className="text-muted-foreground text-lg md:text-xl">
            Para Mercado Livre e E-commerce Brasileiro
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="shadow-xl border-primary/20 hover:shadow-2xl transition-shadow">
            <CardHeader className="bg-gradient-to-br from-primary/5 to-secondary/5">
              <CardTitle className="text-primary">Configuração</CardTitle>
              <CardDescription>
                Configure os parâmetros para gerar seus códigos EAN-13
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>Prefixo Brasileiro</Label>
                <RadioGroup value={prefix} onValueChange={setPrefix}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="789" id="789" />
                    <Label htmlFor="789" className="cursor-pointer">789</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="790" id="790" />
                    <Label htmlFor="790" className="cursor-pointer">790</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cnpj">5 Primeiros Dígitos do CNPJ</Label>
                <Input
                  id="cnpj"
                  type="text"
                  maxLength={5}
                  value={cnpjDigits}
                  onChange={(e) => setCnpjDigits(e.target.value.replace(/\D/g, ''))}
                  placeholder="12345"
                  className="text-lg font-mono border-primary/30 focus:border-primary"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">Quantidade de EANs</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  max="1000"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="1"
                  className="text-lg font-mono border-primary/30 focus:border-primary"
                />
              </div>

              {lastBaseCode && (
                <div className="p-4 bg-gradient-to-br from-secondary/20 to-primary/10 rounded-lg space-y-2 border border-secondary/30">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Último Código Base</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={resetLastCode}
                      className="h-8 px-2 hover:bg-secondary/20"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="font-mono text-lg font-bold text-primary">{lastBaseCode}</p>
                </div>
              )}

              <Button 
                onClick={generateEans} 
                className="w-full text-lg h-12 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl transition-all"
                size="lg"
              >
                Gerar EANs
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-xl border-primary/20 hover:shadow-2xl transition-shadow">
            <CardHeader className="bg-gradient-to-br from-primary/5 to-secondary/5">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-primary">Códigos Gerados</CardTitle>
                  <CardDescription>
                    {generatedCodes.length > 0 && `${generatedCodes.length} código(s) gerado(s)`}
                  </CardDescription>
                </div>
                {generatedCodes.length > 0 && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyAllCodes}
                      className="border-primary/30 hover:bg-primary hover:text-primary-foreground"
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copiar Todos
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={downloadCodes}
                      className="border-secondary/50 hover:bg-secondary hover:text-secondary-foreground"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Baixar
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {generatedCodes.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>Nenhum código gerado ainda</p>
                  <p className="text-sm mt-2">Configure e clique em "Gerar EANs"</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                  {generatedCodes.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gradient-to-r from-primary/5 to-secondary/5 rounded-lg hover:from-primary/10 hover:to-secondary/10 transition-all border border-primary/10"
                    >
                      <span className="font-mono text-lg font-bold text-foreground">
                        {item.code}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyCode(item.code)}
                        className="hover:bg-primary/20"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Estrutura do EAN-13</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="p-4 bg-primary/10 rounded-lg text-center">
                <p className="text-sm text-muted-foreground mb-1">Prefixo Brasil</p>
                <p className="font-mono text-xl font-bold text-primary">789/790</p>
                <p className="text-xs text-muted-foreground mt-1">3 dígitos</p>
              </div>
              <div className="p-4 bg-accent/10 rounded-lg text-center">
                <p className="text-sm text-muted-foreground mb-1">CPF</p>
                <p className="font-mono text-xl font-bold text-accent">XXXXX</p>
                <p className="text-xs text-muted-foreground mt-1">5 dígitos</p>
              </div>
              <div className="p-4 bg-secondary rounded-lg text-center">
                <p className="text-sm text-muted-foreground mb-1">Sequencial</p>
                <p className="font-mono text-xl font-bold">XXXX</p>
                <p className="text-xs text-muted-foreground mt-1">4 dígitos</p>
              </div>
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-sm text-muted-foreground mb-1">Verificador</p>
                <p className="font-mono text-xl font-bold">X</p>
                <p className="text-xs text-muted-foreground mt-1">1 dígito</p>
              </div>
              <div className="p-4 bg-foreground/5 rounded-lg text-center flex items-center justify-center">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total</p>
                  <p className="font-mono text-2xl font-bold text-foreground">13</p>
                  <p className="text-xs text-muted-foreground mt-1">dígitos</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EanGenerator;
