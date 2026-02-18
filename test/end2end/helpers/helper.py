import base64
import os
from typing import List, Dict

from selenium.webdriver.common.by import By
from seleniumbase import BaseCase

# Elements should appear in the DOM on success:
# only once
_root_ = '//html2pdf4doc-root'
_content_flow_ = '//html2pdf4doc-content-flow'
_content_flow_start_ = '//html2pdf4doc-content-flow-start'
_content_flow_end_ = '//html2pdf4doc-content-flow-end'
_paper_flow_ = '//html2pdf4doc-paper-flow'
_overlay_flow_ = '//html2pdf4doc-overlay-flow'
# in number of printed pages
_page_start_ = _content_flow_ + '//html2pdf4doc-page'
_paper_ = _paper_flow_ + '/html2pdf4doc-virtual-paper'
_page_chrome_ = _overlay_flow_ + '/html2pdf4doc-page-chrome'
_page_body_ = _page_chrome_ + '/html2pdf4doc-page-body-spacer'
_page_header_ = _page_chrome_ + '/html2pdf4doc-page-header'
_page_footer_ = _page_chrome_ + '/html2pdf4doc-page-footer'

# Elements with content, empty ones don't appear
# _frontpage_content_ = _content_flow_ + '//html2pdf4doc-frontpage'
# _header_content_ = _overlay_flow_ + '//html2pdf4doc-header'
# _footer_content_ = _overlay_flow_ + '//html2pdf4doc-footer'

# --- Local file URL helpers ---------------------------------------------------

def make_file_url(base_folder: str, filename: str) -> str:
    """Build a file:/// URL for a given filename residing in base_folder.

    Example:
        make_file_url("/path/to/cases", "case001.html")
        -> "file:////path/to/cases/case001.html"
    """
    return f"file:///{os.path.join(base_folder, filename)}"


def case_url_num(base_folder: str, n: int, prefix: str = "case", ext: str = "html") -> str:
    """Build a canonical test-case URL like case001.html in base_folder.

    Args:
        base_folder: directory that contains the HTML fixtures
        n: case number (will be zero‑padded to 3 digits)
        prefix: filename prefix (default: "case")
        ext: file extension (default: "html")

        Format f"case{n:03}.html":
        n = 1  → case001.html
        n = 10 → case010.html
        n = 100 → case100.html
    """
    return make_file_url(base_folder, f"{prefix}{n:03}.{ext}")

def case_url(base_folder: str, n, prefix: str = "case", ext: str = "html") -> str:
    # n is str: "001", "010", "100" ... → case_001.html
    return make_file_url(base_folder, f"{prefix}_{n}.{ext}")

class Helper:
    def __init__(self, test_case: BaseCase) -> None:
        assert isinstance(test_case, BaseCase)
        self.test_case: BaseCase = test_case

    def is_chrome(self) -> bool:
        return self.test_case.browser == "chrome"

    def do_open(self, file: str, verify_logs: bool = False) -> None:
        self.test_case.open(file)
        self.test_case.wait_for_ready_state_complete()
        self.test_case.assert_no_404_errors()

        #
        # Verify that the logs only contain the expected messages and nothing else.
        #
        if not self.is_chrome():
            # Getting browser logs is not yet supported on non-Chrome browsers.
            return

        if verify_logs:
            logs = self.get_all_console_logs()
            info_logs = []
            error_logs = []
            for log_ in logs:
                if log_["level"] in ("INFO", "DEBUG"):
                    info_logs.append(log_)
                elif log_["level"] != "WARNING":
                    error_logs.append(log_)

            if len(info_logs) != 4 or len(error_logs) > 0:
                print("Unexpected logs:")
                for line_idx_, line_ in enumerate(logs):
                    print(f"L{line_idx_} => {line_}")
                assert False

            assert "[HTML2PDF4DOC] Version:" in logs[0]["message"]
            assert "[HTML2PDF4DOC] Config:" in logs[1]["message"]
            # Between these stable and expected log lines, some warning lines
            # can appear, for example the typical:
            # "The printable area is currently unspecified..." warning.
            assert "[HTML2PDF4DOC] Page count:" in logs[-2]["message"]
            assert "[HTML2PDF4DOC] Total time:" in logs[-1]["message"]
        else:
            self.test_case.assert_no_js_errors()

    def do_open_and_assert(self, file: str, text: str, verify_logs: bool = False) -> None:
        self.do_open(file, verify_logs=verify_logs)
        self.test_case.assert_text(text)

    def do_open_and_assert_title(self, file: str, title: str) -> None:
        self.do_open(file)
        self.test_case.assert_title(title)

    def do_print_page_to_pdf(self, path_to_output_pdf: str) -> None:
        """
        Uses Chrome DevTools Protocol to save the current page as PDF.
        """

        driver = self.test_case.driver

        # Ensure your driver is Chrome
        if "chrome" not in driver.capabilities["browserName"].lower():
            raise RuntimeError("PDF printing only works in Chrome")

        # Send command to Chrome
        result = driver.execute_cdp_cmd("Page.printToPDF", {
            "printBackground": True,  # Include background graphics
            "landscape": False,  # Portrait mode
            "paperWidth": 8.27,  # A4 width in inches
            "paperHeight": 11.69,  # A4 height in inches
        })

        # Save PDF
        pdf_data = base64.b64decode(result["data"])
        with open(path_to_output_pdf, "wb") as f:
            f.write(pdf_data)
        print(f"PDF saved to {path_to_output_pdf}")

    def open_case_num(self, base_folder: str, n: int, prefix: str = "case", ext: str = "html") -> None:
        """Open a numbered HTML test case from base_folder.

        Example usage in tests:
            self.helper.open_case(path_to_this_test_file_folder, 1)
            OR
            self.helper.open_case(path_to_this_test_file_folder, 7, prefix="grid", ext="htm")
            # -> file:///.../grid007.htm
        """
        self.do_open(case_url(base_folder, n, prefix, ext))

    def open_case(self, base_folder: str, n: str, prefix: str = "case", ext: str = "html") -> None:
        self.do_open(case_url(base_folder, n, prefix, ext))

    def open_case_allow_resource_404(self, base_folder: str, n: str, prefix: str = "case", ext: str = "html") -> None:
        self.test_case.open(case_url(base_folder, n, prefix, ext))
        self.test_case.wait_for_ready_state_complete()

    # html2pdf4doc elements

    def assert_no_html2pdf4doc_elements(self) -> None:
        self.test_case.assert_no_404_errors()
        self.test_case.assert_element_not_present(_root_, by=By.XPATH)

    def assert_html2pdf4doc_elements(self) -> None:
        self.test_case.assert_element_present(_root_, by=By.XPATH)

        self.test_case.assert_element_present(_content_flow_, by=By.XPATH)
        self.test_case.assert_element_present(_content_flow_start_, by=By.XPATH)
        self.test_case.assert_element_present(_content_flow_end_, by=By.XPATH)
        self.test_case.assert_element_present(_page_start_, by=By.XPATH)

        self.test_case.assert_element_present(_paper_flow_, by=By.XPATH)
        self.test_case.assert_element_present(_paper_, by=By.XPATH)

        self.test_case.assert_element_present(_overlay_flow_, by=By.XPATH)
        self.test_case.assert_element_present(_page_chrome_, by=By.XPATH)
        self.test_case.assert_element_present(_page_body_, by=By.XPATH)
        self.test_case.assert_element_present(_page_header_, by=By.XPATH)
        self.test_case.assert_element_present(_page_footer_, by=By.XPATH)

    def assert_html2pdf4doc_success(self) -> None:
        self.test_case.assert_attribute(_root_, 'success')

    #
    # Console logs
    #
    def get_all_console_logs(self) -> List[Dict[str, str]]:
        """
        Get all console logs collected by the browser until now.

        It is important that pytest is run with --log-cdp flag (see tasks.py).

        IMPORTANT: The behavior of get_log() is DESTRUCTIVE! If it is called
        again, the returned array will always be empty. This method must only
        be called by tests that do not call assert_no_js_errors() because it also
        calls get_log() under the hood and that clears all the logs.

        EXAMPLE: A typical object returned by get_log looks like this:
        [
            {
                'level': 'INFO',
                'message': 'file:///.../bundle.js 6:28130 "[HTML2PDF4DOC] Version:" "0.2.3"',
                'source': 'console-api',
                'timestamp': 1763338530327
            },
            ...
        ]
        """

        logs = self.test_case.driver.get_log("browser")
        return logs

    # Pages & Paper

    def get_print_area_height(self) -> int:
        paper_body = self.test_case.find_element(
            f'{_page_body_}',
            by=By.XPATH,
        )
        return paper_body.size['height']

    def get_print_area_width(self) -> int:
        paper_body = self.test_case.find_elements(
            f'{_page_body_}',
            by=By.XPATH,
            limit=1
        )
        return paper_body.size['width']

    def _get_amount_of_virtual_paper(self) -> int:
        all_papers = self.test_case.find_elements(
            f'{_paper_}',
            by=By.XPATH,
        )
        return len(all_papers)

    def _get_amount_of_virtual_pages(self) -> int:
        all_pages = self.test_case.find_elements(
            f'{_page_start_}',
            by=By.XPATH,
        )
        return len(all_pages)

    def assert_document_has_pages(
        self,
        count: int,
        *,
        report: bool = False
    ) -> None:
        paper = self._get_amount_of_virtual_paper()
        pages = self._get_amount_of_virtual_pages()
        if report:
            print('-> paper:', paper)
            print('-> pages:', pages)
        assert paper == count, f"{paper} == {count}, pages: {pages}"
        assert pages == count, f"{pages} == {count}, paper: {paper}"

    # Element

    def assert_element(self, element_xpath) -> None:
        self.test_case.assert_element_present(element_xpath, by=By.XPATH)

    def assert_element_has_text(self, element_xpath, text: str) -> None:
        self.test_case.assert_element(
            f"{element_xpath}"
            f"[contains(., '{text}')]",
            by=By.XPATH,
        )

    def assert_element_contains(self, element_xpath, text: str) -> None:
        self.test_case.assert_element(
            f"{element_xpath}"
            f"//*[contains(., '{text}')]",
            by=By.XPATH,
        )

    def assert_element_has_attribute(self, element_xpath, attribute: str) -> None:
        target = self.test_case.find_element(
            f'{element_xpath}',
            by=By.XPATH,
        )
        attr_value = self.test_case.get_attribute(
            f'{element_xpath}',
            attribute,
            by=By.XPATH
        )
        assert attr_value is not None, \
            f"Expected element to have [{attribute}]"

    def assert_element_attribute_equals(self, element_xpath, attribute: str, expected: str) -> None:
        attr_value = self.test_case.get_attribute(
            f'{element_xpath}',
            attribute,
            by=By.XPATH
        )
        assert attr_value is not None, \
            f"Expected element to have [{attribute}]"
        assert attr_value == expected, \
            f"Expected [{attribute}]='{expected}', got '{attr_value}'"

    # We use get_attribute('textContent') on the <style> tag to read the CSS text inside it
    # (Selenium returns DOM properties as “attributes”).
    # the same: in assert_element_attribute_contains
    def assert_style_contains_text(self, element_xpath, attribute: str, expected_substring: str) -> None:
        attr_value = self.test_case.get_attribute(
            f'{element_xpath}',
            attribute,
            by=By.XPATH
        )
        assert attr_value is not None, \
            f"Expected element to have [{attribute}]"
        assert expected_substring in attr_value, \
            f"Expected [{attribute}] to contain '{expected_substring}', got '{attr_value}'"

    def assert_element_attribute_contains(self, element_xpath, attribute: str, expected_substring: str) -> None:
        attr_value = self.test_case.get_attribute(
            f'{element_xpath}',
            attribute,
            by=By.XPATH
        )
        assert attr_value is not None, \
            f"Expected element to have [{attribute}]"
        assert expected_substring in attr_value, \
            f"Expected [{attribute}] to contain '{expected_substring}', got '{attr_value}'"

    def assert_element_attribute_equals_direct(self, element_xpath, attribute: str, expected: str) -> None:
        target = self.test_case.find_element(
            f'{element_xpath}',
            by=By.XPATH,
        )
        attr_value = target.get_attribute(attribute)
        assert attr_value is not None, \
            f"Expected element to have [{attribute}]"
        assert attr_value == expected, \
            f"Expected [{attribute}]='{expected}', got '{attr_value}'"

    def assert_element_attribute_in_direct(self, element_xpath, attribute: str, expected_values) -> None:
        target = self.test_case.find_element(
            f'{element_xpath}',
            by=By.XPATH,
        )
        attr_value = target.get_attribute(attribute)
        assert attr_value is not None, \
            f"Expected element to have [{attribute}]"
        assert attr_value in expected_values, \
            f"Expected [{attribute}] in {expected_values}, got '{attr_value}'"

    def assert_element_attribute_absent_direct(self, element_xpath, attribute: str) -> None:
        target = self.test_case.find_element(
            f'{element_xpath}',
            by=By.XPATH,
        )
        attr_value = target.get_attribute(attribute)
        assert attr_value is None, \
            f"Expected element to not have [{attribute}], got '{attr_value}'"

    def assert_elements_attribute_not_contains(
        self,
        selector_attribute: str,
        attribute_to_check: str,
        forbidden_substring: str
    ) -> None:
        # Find all elements with the selector attribute and ensure the checked
        # attribute does not contain the forbidden substring.
        elements = self.test_case.find_elements(
            f'//*[@{selector_attribute}]',
            by=By.XPATH,
        )
        for element in elements:
            attr_value = element.get_attribute(attribute_to_check) or ''
            assert forbidden_substring not in attr_value, \
                (
                    f"Expected [{attribute_to_check}] to not contain '{forbidden_substring}', "
                    f"got '{attr_value}' in element: {element.get_attribute('outerHTML')}"
                )

    def assert_elements_attribute_contains(
        self,
        selector_attribute: str,
        attribute_to_check: str,
        expected_substring: str
    ) -> None:
        # Find all elements with the selector attribute and ensure the checked
        # attribute contains the expected substring.
        elements = self.test_case.find_elements(
            f'//*[@{selector_attribute}]',
            by=By.XPATH,
        )
        for element in elements:
            attr_value = element.get_attribute(attribute_to_check)
            assert attr_value is not None, \
                f"Expected element to have [{attribute_to_check}]"
            assert expected_substring in attr_value, \
                (
                    f"Expected [{attribute_to_check}] to contain '{expected_substring}', "
                    f"got '{attr_value}' in element: {element.get_attribute('outerHTML')}"
                )

    def assert_element_starts_page(self, element_xpath: str, page_number: int, element_order: int = 1) -> None:
        attr_value = self.test_case.get_attribute(
            f'({_content_flow_}{element_xpath})[{element_order}]',
            'html2pdf4doc-page-start',
            by=By.XPATH
        )
        expected = str(page_number)
        assert attr_value == expected, f"Expected html2pdf4doc-page-start='{expected}', got '{attr_value}'"

    def assert_element_ends_page(self, element_xpath: str, page_number: int, element_order: int = 1) -> None:
        attr_value = self.test_case.get_attribute(
            f'({_content_flow_}{element_xpath})[{element_order}]',
            'html2pdf4doc-page-end',
            by=By.XPATH
        )
        expected = str(page_number)
        assert attr_value == expected, f"Expected html2pdf4doc-page-end='{expected}', got '{attr_value}'"

    def assert_element_on_the_page(
        self,
        element_xpath,
        page_number,
        element_order: int = 1,
        *,
        report: bool = False,
    ) -> None:
        element = self.test_case.find_element(
            f'({_content_flow_}{element_xpath})[{element_order}]',
            by=By.XPATH,
        )
        self._assert_element_position_on_page(element, page_number, report=report)

    def assert_text_on_the_page(
        self,
        text: str,
        page_number: int,
        *,
        element_order: int = 1,
        report: bool = False
    ) -> None:
        element = self.test_case.find_element(
            f"({_content_flow_}//*[contains(., {self._xpath_literal(text)})])[{element_order}]",
            by=By.XPATH,
        )
        self._assert_element_position_on_page(element, page_number, report=report)

    def assert_elements_order(self, element1_xpath, element2_xpath) -> None:
        element1 = self.test_case.find_element(
            f'{_content_flow_}{element1_xpath}',
            by=By.XPATH,
        )
        element1_y = element1.location["y"]
        element2 = self.test_case.find_element(
            f'{_content_flow_}{element2_xpath}',
            by=By.XPATH,
        )
        element2_y = element2.location["y"]
        assert element1_y < element2_y

    def _assert_element_position_on_page(
        self,
        element,
        page_number: int,
        report: bool = False
    ) -> None:
        # Check that the object is shifted to the specific page.
        # That is, it is lower than the top of the specific page.
        element_y = element.location["y"]

        # pages
        pages = self._get_amount_of_virtual_pages()

        # page_anchor
        if page_number == 1:
            page_anchor = self.test_case.find_element(
                f'{_page_start_}[@page="{page_number}"]',
                by=By.XPATH,
            )
        else:
            page_anchor = self.test_case.find_element(
                f'{_page_start_}[@page="{page_number}"]/html2pdf4doc-virtual-paper-gap',
                by=By.XPATH,
            )
        page_y = page_anchor.location["y"]

        # next_page_anchor
        if page_number < pages:
            next_page_anchor = self.test_case.find_element(
                f'{_page_start_}[@page="{page_number + 1}"]/html2pdf4doc-virtual-paper-gap',
                by=By.XPATH,
            )
            next_page_y = next_page_anchor.location["y"]
        else:
            next_page_y = None

        if next_page_y is not None:
            cond1 = page_y < element_y
            cond2 = next_page_y > element_y
            if report:
                print('-> page_y: ', page_y)
                print('-> element_y: ', element_y)
                print('-> next_page_y: ', next_page_y)
            assert cond1 & cond2
        else:
            # The last page
            cond1 = page_y < element_y
            if report:
                print('-> page_y: ', page_y)
                print('-> element_y: ', element_y)
            assert cond1

    def _xpath_literal(self, text: str) -> str:
        if "'" not in text:
            return f"'{text}'"
        if '"' not in text:
            return f'"{text}"'
        parts = text.split("'")
        quoted_parts = []
        for i, part in enumerate(parts):
            if part:
                quoted_parts.append(f"'{part}'")
            else:
                quoted_parts.append("''")
            if i < len(parts) - 1:
                quoted_parts.append('"\'"')
        return f"concat({', '.join(quoted_parts)})"

    # Element direct children

    def assert_direct_children_absent(self, parent_xpath: str, child_xpaths) -> None:
        """
        Assert that the parent element does not have the specified direct children.

        Args:
            parent_xpath: XPath of the parent element
            child_xpaths: list of XPath expressions for direct children to check absence of
        """
        parent = self.test_case.find_element(parent_xpath, by=By.XPATH)
        for cx in child_xpaths:
            found = parent.find_elements(By.XPATH, f"./{cx.lstrip('./')}")
            assert len(found) == 0, f"Expected no direct child {cx} under {parent_xpath}"

    def assert_direct_children_present(self, parent_xpath: str, child_xpaths) -> None:
        """
        Assert that the parent element has the specified direct children.

        Args:
            parent_xpath: XPath of the parent element
            child_xpaths: list of XPath expressions for direct children to check presence of
        """
        parent = self.test_case.find_element(parent_xpath, by=By.XPATH)
        for cx in child_xpaths:
            found = parent.find_elements(By.XPATH, f"./{cx.lstrip('./')}")
            assert len(found) > 0, f"Expected direct child {cx} under {parent_xpath}"

    # Element dimensions

    def assert_element_fit_height(self, element_xpath) -> None:
        # Check if the element fits in the printable area in height
        element = self.test_case.find_element(
            f'{_content_flow_}{element_xpath}',
            by=By.XPATH,
        )
        printAreaHeight = self.get_print_area_height()
        print('printAreaHeight', printAreaHeight)
        elementHeight = self._get_element_height(element)
        print('elementHeight', elementHeight)
        assert elementHeight <= printAreaHeight

    def assert_element_fit_width(self, element_xpath) -> None:
        # Check if the element fits in the printable area by width
        element = self.test_case.find_element(
            f'{_content_flow_}{element_xpath}',
            by=By.XPATH,
        )
        printAreaWidth = self.get_print_area_width()
        elementWidth = self._get_element_width(element)
        assert elementWidth < printAreaWidth

    def _get_element_width(self, element) -> int:
        return element.size['width']

    def _get_element_height(self, element) -> int:
        return element.size['height']

        # /*[@data-content-flow-end]
        # /html2pdf4doc-content-flow-end

    # SIMPLE

    def assert_text(self, text: str) -> None:
        self.test_case.assert_text(text)

    def wait_for(self, element_xpath: str) -> None:
        self.test_case.wait_for_element(element_xpath, by=By.XPATH)
